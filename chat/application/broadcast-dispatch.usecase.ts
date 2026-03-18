import { PrismaClient } from "@prisma/client";
import { CreateConversationUseCase } from "./create-conversation.usecase";
import { SendMessageInput } from "./send-message.usecase";
import { CreatePendingMessageUseCase } from "./create-pending-message.usecase";
import { PrismaContactRepository } from "../infra/repositories/prisma-contact-repository";
import { PrismaContactInboxRepository } from "../infra/repositories/prisma-contact-inbox-repository";
import { PrismaConversationRepository } from "../infra/repositories/prisma-conversation-repository";
import { PrismaInboxRepository } from "../infra/repositories/prisma-inbox-repository";
import { PrismaMessageRepository } from "../infra/repositories/prisma-message-repository";
import { getBullMQBroadcaster } from "../infra/events/bullmq-broadcaster";
import { SendMessageUseCase } from "./send-message.usecase";
import { CreateBroadcastUseCase } from "./broadcast/create-broadcast.usecase";
import { BroadcastMessageBuilder } from "./broadcast/broadcast-message-builder";
import { DefaultTemplateBroadcastMessageBuilderUseCase } from "./broadcast/default-template-message-builder.usecase";
import { getBroadcastPrepareQueue } from "../infra/queue/broadcast-prepare.queue";
import { validateChatbotOutboundFlow } from "../infra/integrations/chatbot-broadcast-integration";
import { normalizeContacts } from "./utils/normalize-contacts";

type BroadcastDispatchInput = {
  inboxId: string;
  createdById: string;
  name?: string | null;
  chatbotFlowId?: string | null;
  forceChatbotAssign?: boolean;
  keepChatbot?: boolean;
  contacts: Array<{
    phoneNumber: string;
    contactName?: string | null;
    clientId?: number | null;
  }>;
  message: Omit<SendMessageInput, "conversationId" | "assigneeId"> & {
    assigneeId?: string | null;
  };
};

type BroadcastDispatchResult = {
  accepted: number;
  invalid: string[];
  broadcastId: string;
};

export class BroadcastDispatchUseCase {
  private readonly messageBuilder: BroadcastMessageBuilder;

  constructor(
    private readonly prisma: PrismaClient,
    messageBuilder?: BroadcastMessageBuilder,
  ) {
    this.messageBuilder =
      messageBuilder ?? new DefaultTemplateBroadcastMessageBuilderUseCase(prisma);
  }

  async execute(input: BroadcastDispatchInput): Promise<BroadcastDispatchResult> {
    const { inboxId, contacts, message, createdById, chatbotFlowId, forceChatbotAssign } = input;
    const normalized = normalizeContacts(contacts);

    const hasTemplate = Boolean(message?.contentAttributes?.template);
    const hasChatbotFlow = Boolean(chatbotFlowId);
    if (!hasTemplate && !hasChatbotFlow) {
      throw new Error("BROADCAST_MESSAGE_REQUIRED");
    }
    if (chatbotFlowId) {
      await validateChatbotOutboundFlow(chatbotFlowId);
    }

    const createBroadcastUseCase = new CreateBroadcastUseCase(this.prisma);
    const broadcast = await createBroadcastUseCase.execute({ inboxId, createdById, name: input.name });

    const queue = getBroadcastPrepareQueue();
    await queue.add(
      "broadcast-prepare",
      {
        broadcastId: broadcast.id,
        inboxId,
        contacts: normalized.valid,
        invalidContacts: normalized.invalid,
        message,
        chatbotFlowId: chatbotFlowId ?? null,
        forceChatbotAssign: Boolean(forceChatbotAssign),
        keepChatbot: Boolean(input.keepChatbot),
      },
      { jobId: broadcast.id, removeOnComplete: true, removeOnFail: false },
    );

    return { accepted: normalized.valid.length, invalid: normalized.invalid, broadcastId: broadcast.id };
  }

  // normalization delegated to shared util: normalize-contacts.ts
}

