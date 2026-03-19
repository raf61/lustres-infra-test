import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { IContactRepository } from '../domain/repositories/contact-repository';
import { IContactInboxRepository } from '../domain/repositories/contact-inbox-repository';
import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IMessageRepository } from '../domain/repositories/message-repository';
import { IBroadcaster } from '../domain/events/broadcaster';
import { InboundMessage } from '../domain/message';
import { getDownloadMediaQueue } from '../infra/queue/download-media.queue';
import { getChatEventsQueue } from '../infra/queue/chat-events.queue';
import { getChatbotEventsQueue } from '../../chatbot/infra/queue/chatbot-events.queue';
import { getBrazilianPhoneAlternatives } from './utils/brazil-phone';
import { standardizeWaId } from './utils/standardize-wa-id';
import { prisma } from '../../lib/prisma';


export class HandleInboundUseCase {
  constructor(
    private readonly inboxRepository: IInboxRepository,
    private readonly contactRepository: IContactRepository,
    private readonly contactInboxRepository: IContactInboxRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly broadcaster: IBroadcaster
  ) { }

  async execute(messages: InboundMessage[]): Promise<void> {
    for (const msg of messages) {
      try {
        // 1. Localizar Inbox (pelo phoneNumberId do webhook)
        const phoneNumberId = msg.phoneNumberId;
        if (!phoneNumberId) {
          console.warn('[HandleInbound] Message without phoneNumberId, skipping.', msg.id);
          continue;
        }

        const inbox = await this.inboxRepository.findByPhoneNumberId(phoneNumberId);
        if (!inbox) {
          console.warn(`[HandleInbound] Inbox not found for phoneNumberId: ${phoneNumberId}. Skipping message ${msg.id}`);
          continue;
        }

        // 2. Garantir Contato via ContactInbox (IGUAL CHATWOOT)
        if (!msg.from) continue;
        const sourceId = standardizeWaId(msg.from); // No WhatsApp, sourceId = número do cliente

        const profileName = msg.profileName;

        // 2.1 Buscar primeiro pelo sourceId na Inbox (igual Chatwoot)
        let contactInbox = await this.contactInboxRepository.findBySourceIdAndInbox(sourceId, inbox.id);

        if (!contactInbox) {
          // Fallback BR: tentar variação com/sem o '9' após o DDD para evitar duplicatas.
          // getBrazilianPhoneAlternatives exclui linhas fixas (Caveat C corrigido).
          for (const alt of getBrazilianPhoneAlternatives(sourceId)) {
            const found = await this.contactInboxRepository.findBySourceIdAndInbox(alt, inbox.id);
            if (found) {
              console.warn("[HandleInbound] SourceId variant matched. Reusing existing contactInbox.", {
                sourceId,
                matchedAlt: alt,
                inboxId: inbox.id,
                contactId: found.contactId,
              });

              // Atualiza o sourceId do vínculo para o que veio no webhook agora
              // (assim futuras mensagens não criarão novo contato).
              contactInbox = await this.contactInboxRepository.ensureContactInbox(found.contactId, inbox.id, sourceId);
              break;
            }
          }
        }

        if (!contactInbox) {
          // 2.2 Não existe vínculo: criar Contact global + ContactInbox
          const contact = await this.contactRepository.ensureContact(sourceId, profileName);
          contactInbox = await this.contactInboxRepository.ensureContactInbox(contact.id, inbox.id, sourceId);
        }

        const contactId = contactInbox.contactId;

        // 3. Garantir Conversa (sempre reutiliza a mesma - single conversation)
        const { conversation, isNew: isNewConversation, isReopened: isReopenedConversation } = await this.conversationRepository.ensureConversation(contactId, inbox.id);

        // Se criou conversa nova, broadcast direto (não precisa de lógica adicional)
        if (isNewConversation) {
          await this.broadcaster.broadcast({
            type: 'conversation.created',
            payload: {
              id: conversation.id,
              contactId: conversation.contactId,
              inboxId: conversation.inboxId,
              status: conversation.status,
            },
          });
          console.log(`[HandleInbound] New conversation ${conversation.id} created, broadcast sent`);
        }

        // 4. Resolver in_reply_to
        let inReplyTo: string | null = null;
        const inReplyToExternalId = msg.inReplyTo || null;

        if (inReplyToExternalId) {
          const replyToMessage = await this.messageRepository.findByProviderMessageId(inReplyToExternalId);
          inReplyTo = replyToMessage?.id || null;
        }

        // 5. Salvar a Mensagem (idempotente: retorna null se já existir)
        const timestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();
        const attachments = this.extractAttachments(msg);

        const savedMessage = await this.messageRepository.create({
          conversationId: conversation.id,
          providerMessageId: msg.id,
          messageType: 'incoming',
          contentType: msg.type || 'text',
          content: msg.text || msg.caption,
          status: 'sent',  // Mensagens incoming usam 'sent' como padrão (igual Chatwoot)
          timestamp: timestamp,
          contentAttributes: {
            inReplyTo,
            inReplyToExternalId,
            interactive: msg.interactive,
            reaction: msg.reaction,
            reactedTo: msg.reactedTo,
            location: msg.location,
            contacts: msg.contacts,
          },
          additionalAttributes: {
            waId: msg.from,
            mediaId: msg.mediaId,
            mediaMeta: msg.mediaMeta,
            displayPhoneNumber: msg.displayPhoneNumber,
          },
          attachments: attachments.length > 0 ? attachments : undefined,
        });

        // Se savedMessage é null, a mensagem já foi processada antes (duplicata)
        if (!savedMessage) {
          console.log(`[HandleInbound] Message ${msg.id} already exists, skipping.`);
          continue;
        }

        // 6. message.created vai pro worker (TEM LÓGICA: reopen, waitingSince, assignee)
        const chatEventsQueue = getChatEventsQueue();
        await chatEventsQueue.add('message.created', {
          type: 'message.created',
          payload: savedMessage,
        }, {
          jobId: `msg-event-${savedMessage.id}` // Idempotência
        });

        // 6.1 Enviar para o Chatbot Worker
        const chatbotEventsQueue = getChatbotEventsQueue();
        await chatbotEventsQueue.add('message.created', {
          type: 'message.created',
          payload: {
            ...savedMessage,
            inboxId: conversation.inboxId,
            isNewConversation,
            isReopenedConversation,
          },
        }, {
          jobId: `chatbot-msg-event-${savedMessage.id}`,
        });

        // 6.2 LÓGICA ESPECIAL DEMO: Garantir que o contato tenha um Client associado
        // (Isso é necessário para aparecer no dashboard do vendedor)
        try {
          const existingLinks = await prisma.clientChatContact.findMany({
            where: { contactId: contactId }
          });

          if (existingLinks.length === 0) {
            console.log(`[HandleInbound] Criando Client para novo contato ${contactId}`);
            
            // Gerar um CNPJ aleatório para o mock
            const randomCnpj = Math.floor(Math.random() * 99999999999999).toString().padStart(14, '0');
            
            const client = await prisma.client.create({
              data: {
                razaoSocial: profileName || sourceId,
                nomeSindico: profileName || sourceId,
                cnpj: randomCnpj,
                telefoneSindico: sourceId,
                observacao: "Cliente criado automaticamente via Chat Inbound (Demo Lustres)",
                kanbanEstado: {
                    create: {
                        code: 0 // "A fazer contato"
                    }
                }

              }
            });

            await prisma.clientChatContact.create({
              data: {
                clientId: client.id,
                contactId: contactId
              }
            });

            console.log(`[HandleInbound] Client ${client.id} criado e vinculado ao contato ${contactId}`);
          }
        } catch (clientError) {
          console.error("[HandleInbound] Erro ao garantir Client para o contato:", clientError);
        }

        console.log(`[HandleInbound] Message ${msg.id} saved and event queued`);

        // 7. Enfileirar download de mídia (idempotente: usa jobId único)
        if (savedMessage.attachments && savedMessage.attachments.length > 0) {
          const downloadQueue = getDownloadMediaQueue();

          for (const attachment of savedMessage.attachments) {
            if (attachment.mediaId) {
              await downloadQueue.add(
                'download-media',
                {
                  attachmentId: attachment.id,
                  mediaId: attachment.mediaId,
                  messageId: savedMessage.id,
                },
                { jobId: attachment.id }
              );
              console.log(`[HandleInbound] Queued download for attachment ${attachment.id}`);
            }
          }
        }

      } catch (error) {
        console.error(`[HandleInbound] Error processing message ${msg.id}:`, error);
      }
    }
  }

  private extractAttachments(msg: InboundMessage) {
    const attachments: any[] = [];
    if (['image', 'video', 'audio', 'document', 'sticker'].includes(msg.type || '')) {
      attachments.push({
        fileType: msg.type,
        mediaId: msg.mediaId,
        externalUrl: msg.mediaMeta?.url,
        mimeType: msg.mediaMimeType,
        fileName: msg.mediaFilename,
        fileSize: msg.mediaMeta?.file_size,
      });
    }
    return attachments;
  }
}
