import { PrismaClient } from "@prisma/client";
import { CreatePendingMessageUseCase } from "../create-pending-message.usecase";
import { PrismaClientChatContactRepository } from "../../infra/repositories/prisma-client-chat-contact-repository";
import { PrismaConversationRepository } from "../../infra/repositories/prisma-conversation-repository";
import { PrismaMessageRepository } from "../../infra/repositories/prisma-message-repository";
import { SendMessageUseCase } from "../send-message.usecase";
import { BroadcastSendMessageUseCase } from "../broadcast-send-message.usecase";
import { getBroadcastSendQueue } from "../../infra/queue/broadcast-send.queue";
import { getChatEventsQueue } from "../../infra/queue/chat-events.queue";
import { CreateBroadcastRecipientUseCase } from "./create-broadcast-recipient.usecase";
import { UpdateBroadcastRecipientUseCase } from "./update-broadcast-recipient.usecase";
import { BroadcastMessageBuilder } from "./broadcast-message-builder";
import { DefaultTemplateBroadcastMessageBuilderUseCase } from "./default-template-message-builder.usecase";
import { ChatbotBroadcastAdapter } from "../../../chatbot/infra/adapters/chatbot-broadcast-adapter";
import { PrismaChatbotFlowRepository } from "../../../chatbot/infra/repositories/prisma-chatbot-flow-repository";
import { PrismaChatbotSessionRepository } from "../../../chatbot/infra/repositories/prisma-chatbot-session-repository";
import { PrismaChatbotPathEventRepository } from "../../../chatbot/infra/repositories/prisma-chatbot-path-event-repository";
import { StartChatbotUseCase } from "../../../chatbot/application/start-chatbot.usecase";
import { SendMessageChatbotAdapter } from "../../../chatbot/infra/senders/send-message-adapter";
import { BullMQChatbotStatusEmitter } from "../../../chatbot/infra/realtime/bullmq-chatbot-status-emitter";

export type ProcessBroadcastDispatchContactInput = {
  broadcastId: string;
  inboxId: string;
  chatbotFlowId?: string | null;
  forceChatbotAssign?: boolean;
  keepChatbot?: boolean;
  message: {
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
      items?: Array<{ title: string; value: string; description?: string }>;
      template?: { name: string; languageCode: string; components: any[] };
    };
    assigneeId?: string | null;
  };
  contact: {
    phoneNumber: string;
    contactName?: string | null;
    clientId?: number | null;
    contactId: string;
    conversationId: string;
    contactInboxId?: string | null;
    assigneeId?: string | null;
  };
  recipientId?: string | null;
};

export class ProcessBroadcastDispatchContactUseCase {
  private readonly messageBuilder: BroadcastMessageBuilder;

  constructor(
    private readonly prisma: PrismaClient,
    messageBuilder?: BroadcastMessageBuilder,
  ) {
    this.messageBuilder =
      messageBuilder ?? new DefaultTemplateBroadcastMessageBuilderUseCase(prisma);
  }

  async execute(input: ProcessBroadcastDispatchContactInput): Promise<void> {
    const clientChatContactRepository = new PrismaClientChatContactRepository();
    const conversationRepository = new PrismaConversationRepository();
    const messageRepository = new PrismaMessageRepository();
    const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository);
    const createPendingMessageUseCase = new CreatePendingMessageUseCase(messageRepository);
    const createBroadcastRecipientUseCase = new CreateBroadcastRecipientUseCase(this.prisma);
    const updateBroadcastRecipientUseCase = new UpdateBroadcastRecipientUseCase(this.prisma);
    const chatEventsQueue = getChatEventsQueue();
    const { getChatbotEventsQueue } = await import("../../../chatbot/infra/queue/chatbot-events.queue");
    const chatbotEventsQueue = getChatbotEventsQueue();
    const sendQueue = getBroadcastSendQueue();
    const flowRepository = new PrismaChatbotFlowRepository();
    const sessionRepository = new PrismaChatbotSessionRepository();
    const pathEventRepository = new PrismaChatbotPathEventRepository();
    const broadcastSendMessageUseCase = new BroadcastSendMessageUseCase(messageRepository, conversationRepository);
    const messageSender = new SendMessageChatbotAdapter(broadcastSendMessageUseCase as any);
    const statusEmitter = new BullMQChatbotStatusEmitter();
    const { SystemChatbotActionProvider } = await import("../../../chatbot/infra/actions/system-actions-adapter");
    const actionProvider = new SystemChatbotActionProvider(this.prisma);

    const startChatbotUseCase = new StartChatbotUseCase(
      flowRepository,
      sessionRepository,
      pathEventRepository,
      messageSender,
      actionProvider,
      statusEmitter
    );
    const chatbotBroadcastAdapter = new ChatbotBroadcastAdapter(
      flowRepository,
      sessionRepository,
      pathEventRepository,
      startChatbotUseCase,
      conversationRepository
    );

    const recipientStatus = {
      pending: "PENDING",
      queued: "QUEUED",
      failed: "FAILED",
    } as const;

    const { contact } = input;

    let recipientId = input.recipientId ?? null;
    try {
      console.log("[BroadcastDispatch] contact start", {
        broadcastId: input.broadcastId,
        phoneNumber: contact.phoneNumber,
      });
      if (input.contact.clientId && input.contact.contactId) {
        const cId = Number(input.contact.clientId);
        console.log(`[BroadcastDispatch] Ensuring link for contact ${input.contact.contactId} and client ${cId}`);
        await clientChatContactRepository.ensureLink(input.contact.contactId, cId);
      } else {
        console.log(`[BroadcastDispatch] Skipping link: clientId=${input.contact.clientId}, contactId=${input.contact.contactId}`);
      }

      if (!recipientId) {
        const created = await createBroadcastRecipientUseCase.execute({
          broadcastId: input.broadcastId,
          contactId: contact.contactId,
          clientId: contact.clientId ? Number(contact.clientId) : null,
          contactInboxId: contact.contactInboxId ?? null,
          status: recipientStatus.pending,
        });
        recipientId = created.id;
      }

      const outboundHandled = await chatbotBroadcastAdapter.scheduleOutbound({
        flowId: input.chatbotFlowId ?? null,
        forceAssign: Boolean(input.forceChatbotAssign),
        keepActiveSession: Boolean(input.keepChatbot),
        templateOverride: input.message?.contentAttributes?.template,
        context: {
          conversationId: contact.conversationId,
          inboxId: input.inboxId,
          broadcastId: input.broadcastId,
          contactName: contact.contactName ?? null,
          phoneNumber: contact.phoneNumber,
          contactId: contact.contactId,
          clientId: contact.clientId ?? null,
          hasAssignee: Boolean(contact.assigneeId),
          assigneeId: input.message?.assigneeId ?? null,
        },
      });

      console.log(`[BroadcastDispatch] outboundHandled result for ${contact.phoneNumber}:`, outboundHandled);

      if (outboundHandled.handled) {
        console.log("[BroadcastDispatch] outbound handled", {
          broadcastId: input.broadcastId,
          phoneNumber: contact.phoneNumber,
          messageId: outboundHandled.messageId ?? null,
        });
        await updateBroadcastRecipientUseCase.execute({
          recipientId,
          messageId: outboundHandled.messageId ?? undefined,
          status: recipientStatus.queued,
        });
        return;
      }

      const hasFallbackPayload =
        Boolean(input.message?.contentAttributes?.template) ||
        Boolean(input.message?.content) ||
        Boolean(input.message?.attachments?.length);
      if (!hasFallbackPayload) {
        await updateBroadcastRecipientUseCase.execute({
          recipientId,
          status: recipientStatus.failed,
        });
        return;
      }

      const builtMessage = await this.messageBuilder.build({
        baseMessage: input.message,
        contact: {
          clientId: contact.clientId ?? null,
          contactId: contact.contactId,
          contactName: contact.contactName ?? null,
          phoneNumber: contact.phoneNumber,
        },
      });

      const pending = await createPendingMessageUseCase.execute({
        conversationId: contact.conversationId,
        assigneeId: builtMessage.assigneeId ?? null,
        content: builtMessage.content,
        contentType: builtMessage.contentType,
        messageType: builtMessage.messageType,
        contentAttributes: {
          ...builtMessage.contentAttributes,
          keepChatbot: Boolean(input.keepChatbot),
        },
        attachments: builtMessage.attachments,
      });
      const messageId = pending?.id ?? null;

      if (!messageId) {
        console.log("[BroadcastDispatch] pending message failed", {
          broadcastId: input.broadcastId,
          phoneNumber: contact.phoneNumber,
        });
        await updateBroadcastRecipientUseCase.execute({
          recipientId,
          status: recipientStatus.failed,
        });
        return;
      }

      await chatEventsQueue.add(
        "message.created",
        { type: "message.created", payload: pending },
        { jobId: `msg-event-${messageId}` },
      );
      await chatbotEventsQueue.add(
        "message.created",
        { type: "message.created", payload: { ...pending, inboxId: input.inboxId } },
        { jobId: `chatbot-msg-event-${messageId}` },
      );

      await sendQueue.add(
        "broadcast-send",
        { messageId },
        { jobId: messageId, removeOnComplete: true, removeOnFail: false },
      );
      await updateBroadcastRecipientUseCase.execute({
        recipientId,
        messageId,
        status: recipientStatus.queued,
      });
      console.log("[BroadcastDispatch] message queued", {
        broadcastId: input.broadcastId,
        phoneNumber: contact.phoneNumber,
        messageId,
      });
    } catch (error) {
      console.error("[BroadcastDispatch] Failed to process contact", {
        broadcastId: input.broadcastId,
        phoneNumber: input.contact.phoneNumber,
        error,
      });

      // Se já temos um recipientId (passado ou criado acima), atualizamos para FAILED
      // Se não temos, criamos um já com status FAILED
      const finalRecipientId = recipientId || input.recipientId;

      if (finalRecipientId) {
        await updateBroadcastRecipientUseCase.execute({
          recipientId: finalRecipientId,
          status: recipientStatus.failed,
        });
      } else {
        await createBroadcastRecipientUseCase.execute({
          broadcastId: input.broadcastId,
          contactId: contact.contactId,
          clientId: contact.clientId ?? null,
          contactInboxId: contact.contactInboxId ?? null,
          status: recipientStatus.failed,
        });
      }
    }
  }
}
