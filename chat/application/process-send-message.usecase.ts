import { IMessageRepository } from '../domain/repositories/message-repository';
import { IBroadcaster } from '../domain/events/broadcaster';
import { sendMessage } from '../infra/provider/whatsapp-cloud.provider';
import { SendMessageJob } from '../infra/queue/send-message.queue';

/**
 * Processa o envio de uma mensagem (chamado pelo worker)
 * Igual ao Chatwoot: SendOnWhatsappService#perform_reply
 */
export class ProcessSendMessageUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly broadcaster: IBroadcaster
  ) {}

  async execute(job: SendMessageJob): Promise<void> {
    const { messageId } = job;

    // 1. Buscar mensagem com relações (conversa, contato, inbox)
    const message = await this.messageRepository.findById(messageId);
    
    if (!message) {
      console.error(`[ProcessSendMessage] Message not found: ${messageId}`);
      return;
    }

    // 2. Validar que é outgoing/template e está pendente
    if (message.messageType !== 'outgoing' && message.messageType !== 'template') {
      console.warn(`[ProcessSendMessage] Message ${messageId} is not outgoing or template, skipping`);
      return;
    }

    if (message.status !== 'pending') {
      console.warn(`[ProcessSendMessage] Message ${messageId} already processed (status: ${message.status})`);
      return;
    }

    // 3. Validar que tem conversa/contato/inbox
    if (!message.conversation) {
      const updatedMessage = await this.messageRepository.markAsFailed(messageId, 'Missing conversation data');
      if (updatedMessage) {
        await this.broadcaster.broadcast({
          type: 'message.updated',
          payload: updatedMessage,
        });
      }
      return;
    }

    // 4. Enviar para o WhatsApp (igual Chatwoot channel.send_message)
    console.log(`[ProcessSendMessage] Sending message ${messageId} to ${message.conversation.sourceId}`);
    
    const result = await sendMessage(message);

    // 5. Atualizar mensagem com resultado
    if (result.success && result.providerMessageId) {
      // Sucesso - salvar source_id (igual Chatwoot message.update!(source_id: message_id))
      const updatedMessage = await this.messageRepository.updateAfterSend(messageId, {
        providerMessageId: result.providerMessageId,
        status: 'sent',
      });
      if (updatedMessage) {
        await this.broadcaster.broadcast({
          type: 'message.updated',
          payload: updatedMessage,
        });
      }
      
      console.log(`[ProcessSendMessage] Message ${messageId} sent successfully (provider: ${result.providerMessageId})`);
    } else {
      // Falha - salvar erro (igual Chatwoot handle_error)
      const errorText = result.error 
        ? `${result.error.code}: ${result.error.title}` 
        : 'Unknown error';
      
      const updatedMessage = await this.messageRepository.markAsFailed(messageId, errorText);

      if (updatedMessage) {
        await this.broadcaster.broadcast({
          type: 'message.updated',
          payload: updatedMessage,
        });
      }
      
      console.error(`[ProcessSendMessage] Message ${messageId} failed: ${errorText}`);
      
      // Re-throw para o BullMQ tentar novamente (se configurado com retries)
      throw new Error(errorText);
    }
  }
}
