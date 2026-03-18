import { IMessageRepository } from "../domain/repositories/message-repository";
import { storage } from "../../lib/storage";

export type CreatePendingMessageInput = {
  conversationId: string;
  assigneeId?: string | null;
  content?: string;
  contentType?: string;
  messageType?: "outgoing" | "template";
  attachments?: Array<{
    fileType: string;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }>;
  contentAttributes?: {
    inReplyTo?: string;
    items?: Array<{
      title: string;
      value: string;
      description?: string;
    }>;
    template?: {
      name: string;
      languageCode: string;
      components: any[];
    };
    [key: string]: any;
  };
};

export class CreatePendingMessageUseCase {
  constructor(private readonly messageRepository: IMessageRepository) { }

  async execute(input: CreatePendingMessageInput) {
    const { conversationId, content, contentType = "text", contentAttributes, attachments } = input;
    let { messageType = "outgoing" } = input;

    if (contentAttributes?.template) {
      messageType = "template";
    }

    let finalContentType = contentType;
    if (messageType === "template") {
      finalContentType = "template";
    }
    if (attachments && attachments.length > 0 && contentType === "text") {
      finalContentType = attachments[0].fileType;
    }
    if (contentAttributes?.items && contentAttributes.items.length > 0) {
      finalContentType = "input_select";
    }

    let inReplyToExternalId: string | null = null;
    if (contentAttributes?.inReplyTo) {
      const replyToMessage = await this.messageRepository.findById(contentAttributes.inReplyTo);
      inReplyToExternalId = replyToMessage?.providerMessageId || null;
    }

    return this.messageRepository.create({
      conversationId,
      messageType,
      contentType: messageType === "template" ? "template" : finalContentType,
      content: content || contentAttributes?.template?.name || "",
      status: "pending",
      timestamp: new Date(),
      contentAttributes: {
        ...(contentAttributes || {}),
        inReplyTo: contentAttributes?.inReplyTo || null,
        inReplyToExternalId,
        template: contentAttributes?.template || null,
        items: contentAttributes?.items || null,
        senderId: input.assigneeId ?? null,
      },
      additionalAttributes: {},
      attachments: attachments?.map((att) => {
        const isInternal = storage.isInternalUrl(att.fileUrl);
        return {
          fileType: att.fileType,
          fileUrl: isInternal ? att.fileUrl : undefined,
          externalUrl: !isInternal ? att.fileUrl : undefined,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          downloadStatus: "completed",
        };
      }),
    });
  }
}

