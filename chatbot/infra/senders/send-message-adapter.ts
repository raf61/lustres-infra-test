import type { IChatbotMessageSender, ChatbotSendMessageInput } from "../../application/ports/chatbot-message-sender";
import { SendMessageUseCase } from "../../../chat/application/send-message.usecase";

export class SendMessageChatbotAdapter implements IChatbotMessageSender {
  constructor(private readonly sendMessageUseCase: SendMessageUseCase) { }

  async send(input: ChatbotSendMessageInput): Promise<{ messageId: string }> {
    const result = await this.sendMessageUseCase.execute({
      conversationId: input.conversationId,
      content: input.content,
      contentType: input.contentType,
      messageType: input.messageType,
      contentAttributes: input.contentAttributes,
      attachments: input.attachments,
    });
    return { messageId: result.message.id };
  }
}
