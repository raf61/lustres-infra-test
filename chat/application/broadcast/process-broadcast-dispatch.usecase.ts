import { PrismaClient } from "@prisma/client";
import { FlowProducer } from "bullmq";
import { PrismaInboxRepository } from "../../infra/repositories/prisma-inbox-repository";
import { BulkEnsureContactsUseCase } from "./bulk-ensure-contacts.usecase";
import { BulkEnsureContactInboxesUseCase } from "./bulk-ensure-contact-inboxes.usecase";
import { BulkEnsureConversationsUseCase } from "./bulk-ensure-conversations.usecase";
import { buildBullmqConnection } from "../../infra/queue/bullmq-connection";

export type ProcessBroadcastDispatchInput = {
  broadcastId: string;
  inboxId: string;
  chatbotFlowId?: string | null;
  forceChatbotAssign?: boolean;
  keepChatbot?: boolean;
  contacts: Array<{
    phoneNumber: string;
    contactName?: string | null;
    clientId?: number | null;
  }>;
  invalidContacts: string[];
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
};

export class ProcessBroadcastDispatchUseCase {
  constructor(private readonly prisma: PrismaClient) { }

  async execute(input: ProcessBroadcastDispatchInput): Promise<void> {
    console.log("[BroadcastDispatch] start", {
      broadcastId: input.broadcastId,
      inboxId: input.inboxId,
      contacts: input.contacts.length,
      invalidContacts: input.invalidContacts.length,
      chatbotFlowId: input.chatbotFlowId ?? null,
      forceChatbotAssign: Boolean(input.forceChatbotAssign),
    });
    const inboxRepository = new PrismaInboxRepository();

    const bulkEnsureContactsUseCase = new BulkEnsureContactsUseCase();
    const bulkEnsureContactInboxesUseCase = new BulkEnsureContactInboxesUseCase();
    const bulkEnsureConversationsUseCase = new BulkEnsureConversationsUseCase();

    const inbox = await inboxRepository.findById(input.inboxId);
    if (!inbox) {
      throw new Error(`INBOX_NOT_FOUND: Inbox ${input.inboxId} does not exist`);
    }

    const recipientStatus = {
      pending: "PENDING",
      failed: "FAILED",
    } as const;

    if (input.invalidContacts.length > 0) {
      await this.prisma.chatBroadcastRecipient.createMany({
        data: input.invalidContacts.map(() => ({
          broadcastId: input.broadcastId,
          status: recipientStatus.failed,
        })),
      });
    }

    const contactMap = await bulkEnsureContactsUseCase.execute(
      input.contacts.map((contact) => ({
        phoneNumber: contact.phoneNumber,
        contactName: contact.contactName ?? null,
      }))
    );
    console.log("[BroadcastDispatch] contacts ensured", {
      broadcastId: input.broadcastId,
      contacts: contactMap.size,
    });

    const contactInboxMap = await bulkEnsureContactInboxesUseCase.execute(
      input.contacts
        .map((contact) => {
          const contactRecord = contactMap.get(contact.phoneNumber);
          if (!contactRecord) return null;
          return {
            contactId: contactRecord.id,
            inboxId: input.inboxId,
            sourceId: contact.phoneNumber,
          };
        })
        .filter(Boolean) as Array<{ contactId: string; inboxId: string; sourceId: string }>
    );
    console.log("[BroadcastDispatch] contactInboxes ensured", {
      broadcastId: input.broadcastId,
      contactInboxes: contactInboxMap.size,
    });

    const conversationSeeds = input.contacts
      .map((contact) => {
        const contactRecord = contactMap.get(contact.phoneNumber);
        if (!contactRecord) {
          console.log(`[BroadcastDispatch] Skipping conversation seed: No contactRecord for ${contact.phoneNumber}`);
          return null;
        }
        return {
          inboxId: input.inboxId,
          phoneNumber: contact.phoneNumber,
          contactId: contactRecord.id,
          contactName: contact.contactName ?? null,
        };
      })
      .filter(Boolean) as Array<{
        inboxId: string;
        phoneNumber: string;
        contactId: string;
        contactName?: string | null;
      }>;

    console.log(`[BroadcastDispatch] Seeding ${conversationSeeds.length} conversations`);

    const conversationMap: Map<
      string,
      { id: string; contactId: string; inboxId: string; assigneeId?: string | null }
    > = await bulkEnsureConversationsUseCase.execute(conversationSeeds);

    console.log("[BroadcastDispatch] conversations ensured", {
      broadcastId: input.broadcastId,
      conversations: conversationMap.size,
    });

    const validContacts = input.contacts
      .map((contact) => {
        const contactRecord = contactMap.get(contact.phoneNumber);
        if (!contactRecord) return null;
        const conversation = conversationMap.get(contactRecord.id);
        if (!conversation) {
          console.log(`[BroadcastDispatch] Skipping valid contact: No conversation mapping for contactId ${contactRecord.id} (${contact.phoneNumber})`);
          return null;
        }
        const contactInbox = contactInboxMap.get(contact.phoneNumber) ?? null;
        return {
          contact,
          contactRecord,
          conversation,
          contactInbox,
        };
      })
      .filter(Boolean) as Array<{
        contact: ProcessBroadcastDispatchInput["contacts"][number];
        contactRecord: { id: string; waId: string; name: string | null };
        conversation: { id: string; contactId: string; inboxId: string; assigneeId: string | null };
        contactInbox: { id: string; contactId: string; inboxId: string; sourceId: string } | null;
      }>;

    if (validContacts.length > 0) {
      await this.prisma.chatBroadcastRecipient.createMany({
        data: validContacts.map((item) => {
          const cId = item.contact.clientId ? Number(item.contact.clientId) : null;
          return {
            broadcastId: input.broadcastId,
            contactId: item.conversation.contactId,
            clientId: cId,
            contactInboxId: item.contactInbox?.id ?? null,
            status: recipientStatus.pending,
          };
        }),
      } as any);
    }

    const contactIds = validContacts.map((item) => item.conversation.contactId);
    const recipientRows =
      contactIds.length > 0
        ? await this.prisma.chatBroadcastRecipient.findMany({
          where: { broadcastId: input.broadcastId, contactId: { in: contactIds } },
          orderBy: { createdAt: "desc" },
          select: { id: true, contactId: true },
        })
        : [];
    const recipientMap = new Map<string, string>();
    for (const row of recipientRows) {
      if (!row.contactId) continue;
      if (!recipientMap.has(row.contactId)) {
        recipientMap.set(row.contactId, row.id);
      }
    }

    const jobs = validContacts.map((item) => ({
      name: "broadcast-dispatch-contact",
      data: {
        broadcastId: input.broadcastId,
        inboxId: input.inboxId,
        chatbotFlowId: input.chatbotFlowId ?? null,
        forceChatbotAssign: Boolean(input.forceChatbotAssign),
        keepChatbot: Boolean(input.keepChatbot),
        message: input.message,
        contact: {
          phoneNumber: item.contact.phoneNumber,
          contactName: item.contact.contactName ?? null,
          clientId: item.contact.clientId ?? null,
          contactId: item.conversation.contactId,
          conversationId: item.conversation.id,
          contactInboxId: item.contactInbox?.id ?? null,
          assigneeId: item.conversation.assigneeId ?? null,
        },
        recipientId: recipientMap.get(item.conversation.contactId) ?? null,
      },
      opts: {
        jobId: `broadcast-dispatch-${input.broadcastId}-${item.conversation.contactId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }));

    if (jobs.length > 0) {
      const flowProducer = new FlowProducer({ connection: buildBullmqConnection() });
      await flowProducer.add({
        name: "broadcast-finish",
        queueName: "chat-broadcast-finish",
        data: { broadcastId: input.broadcastId },
        opts: {
          jobId: `broadcast-finish-${input.broadcastId}`,
          removeOnComplete: true,
          removeOnFail: false,
          failParentOnFailure: false,
        },
        children: jobs.map((job) => ({
          name: job.name,
          queueName: "chat-broadcast-dispatch-contact",
          data: job.data,
          opts: job.opts,
        })),
      });
      await flowProducer.close();
    } else {
      await this.prisma.chatBroadcast.update({
        where: { id: input.broadcastId },
        data: { status: "COMPLETED" },
      });
    }
    console.log("[BroadcastDispatch] done", { broadcastId: input.broadcastId });
  }
}

