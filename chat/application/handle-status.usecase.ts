import { IMessageRepository } from '../domain/repositories/message-repository';
import { IContactRepository } from '../domain/repositories/contact-repository';
import { IContactInboxRepository } from '../domain/repositories/contact-inbox-repository';
import { IBroadcaster } from '../domain/events/broadcaster';
// TODO: acoplamento indevido — chat não deveria conhecer chatbot.
// Idealmente este evento deveria ser publicado via abstração (IEventPublisher)
// e roteado pelo worker de infraestrutura, não pelo use case.
import { getChatbotEventsQueue } from '../../chatbot/infra/queue/chatbot-events.queue';

export interface InboundStatus {
  id: string;           // providerMessageId
  status: string;       // sent, delivered, read, failed
  timestamp: string;
  recipientId: string;
  conversationId?: string;
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
  }>;
}

// Ordem de progressão de status (igual ao Chatwoot)
const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,  // Failed pode acontecer em qualquer momento
};

/**
 * Valida se a transição de status é válida
 * Igual ao Chatwoot: Messages::StatusUpdateService#valid_status_transition?
 * - Não permite voltar de 'read' para 'delivered'
 * - 'failed' pode acontecer em qualquer momento
 */
function isValidStatusTransition(currentStatus: string | null, newStatus: string): boolean {
  // Status inválido
  if (!(newStatus in STATUS_ORDER)) return false;

  // Primeira atualização
  if (!currentStatus) return true;

  // Failed pode acontecer em qualquer momento
  if (newStatus === 'failed') return true;

  // Não pode retroceder (ex: read → delivered)
  const currentOrder = STATUS_ORDER[currentStatus] ?? -1;
  const newOrder = STATUS_ORDER[newStatus];

  return newOrder >= currentOrder;
}

/**
 * Processa webhooks de status de mensagens
 * Igual ao Chatwoot: update_message_with_status + StatusUpdateService
 */
export class HandleStatusUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly contactRepository: IContactRepository,
    private readonly contactInboxRepository: IContactInboxRepository,
    private readonly broadcaster: IBroadcaster
  ) { }

  async execute(statuses: InboundStatus[]): Promise<void> {
    if (statuses.length === 0) return;

    // 1. OTIMIZAÇÃO: Buscar status atual de todas as mensagens do lote em uma única query
    const providerIds = statuses.map(s => s.id);
    const existingMessagesStatus = await this.messageRepository.getStatusesByProviderIds(providerIds);

    const broadcastEvents: any[] = [];
    const chatbotFailedEvents: any[] = [];

    for (const status of statuses) {
      try {
        // 1.1 Usar o mapa em cache em vez de ir no banco em cada volta
        const currentStatus = existingMessagesStatus.get(status.id);

        // Se mensagem não existe, ignorar
        if (currentStatus === undefined) {
          console.log(`[HandleStatus] Message not found: ${status.id}`);
          continue;
        }

        // 2. Validar transição (igual ao Chatwoot)
        if (!isValidStatusTransition(currentStatus, status.status)) {
          console.log(`[HandleStatus] Invalid transition: ${currentStatus} → ${status.status} for ${status.id}`);
          continue;
        }

        // 3. Extrair erro se status for failed (igual Chatwoot)
        let externalError: string | undefined;
        if (status.status === 'failed' && status.errors && status.errors.length > 0) {
          const error = status.errors[0];
          externalError = `${error.code}: ${error.title}`;
        }

        // 4. Atualizar status no banco
        const updatedMessage = await this.messageRepository.updateStatus(status.id, status.status, externalError);

        if (!updatedMessage) {
          continue;
        }

        // 4.1 Lógica do 9º dígito / wa_id (Recomendação Gupshup/Meta)
        // Se o status é 'sent', o recipientId retornado pela Meta é o wa_id canônico.
        if (status.status === 'sent' && status.recipientId && updatedMessage.contactId) {
          const canonicalWaId = status.recipientId;
          const currentContactWithCanonical = await this.contactRepository.findByWaId(canonicalWaId);

          if (!currentContactWithCanonical) {
            // Se o waId canônico ainda não existe na base, atualizamos o contato atual para usá-lo
            await this.contactRepository.update(updatedMessage.contactId, { waId: canonicalWaId } as any);

            // Também garantimos o vínculo de ContactInbox com o novo sourceId
            if (updatedMessage.inboxId) {
              await this.contactInboxRepository.ensureContactInbox(updatedMessage.contactId, updatedMessage.inboxId, canonicalWaId);
            }

            console.log(`[HandleStatus] Updated contact ${updatedMessage.contactId} waId/sourceId to canonical: ${canonicalWaId}`);
          } else if (currentContactWithCanonical.id !== updatedMessage.contactId) {
            // CONFLITO: O waId canônico já pertence a OUTRO contato.
            console.warn(`[HandleStatus] Conflict: Canonical waId ${canonicalWaId} already belongs to contact ${currentContactWithCanonical.id}.`);
          }
        }

        // 5. Acumular eventos para broadcast em lote
        broadcastEvents.push({
          type: 'message.updated',
          payload: {
            id: updatedMessage.id,
            conversationId: updatedMessage.conversationId,
            // @ts-ignore - inboxId é adicionado pelo repositório
            inboxId: updatedMessage.inboxId,
            status: updatedMessage.status,
            externalError: updatedMessage.externalError,
          },
        });

        if (externalError) {
          console.log(`[HandleStatus] Message ${status.id} failed: ${externalError}`);
          chatbotFailedEvents.push({
            messageId: updatedMessage.id,
            conversationId: updatedMessage.conversationId,
            externalError,
          });
        } else {
          console.log(`[HandleStatus] Message ${status.id}: ${currentStatus} → ${status.status}`);
        }
      } catch (error) {
        console.error(`[HandleStatus] Error processing status for ${status.id}:`, error);
      }
    }

    // 6. OTIMIZAÇÃO: Disparar todos os eventos de Realtime em cache em UM ÚNICO pipeline Redis
    if (broadcastEvents.length > 0) {
      if (this.broadcaster.bulkBroadcast) {
        await this.broadcaster.bulkBroadcast(broadcastEvents);
      } else {
        await Promise.all(broadcastEvents.map(e => this.broadcaster.broadcast(e)));
      }
    }

    // 7. Enfileirar falhas para o Chatbot (se houver)
    if (chatbotFailedEvents.length > 0) {
      const chatbotEventsQueue = getChatbotEventsQueue();
      await chatbotEventsQueue.addBulk(chatbotFailedEvents.map(e => ({
        name: 'message.failed',
        data: { type: 'message.failed', payload: e }
      })));
    }
  }
}
