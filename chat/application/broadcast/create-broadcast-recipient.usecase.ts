import { ChatBroadcastRecipientStatus, PrismaClient } from "@prisma/client";

export type CreateBroadcastRecipientInput = {
  broadcastId: string;
  contactId?: string | null;
  clientId?: number | null;
  contactInboxId?: string | null;
  messageId?: string | null;
  status?: ChatBroadcastRecipientStatus;
};

export type CreateBroadcastRecipientResult = {
  id: string;
};

export class CreateBroadcastRecipientUseCase {
  constructor(private readonly prisma: PrismaClient) { }

  async execute(input: CreateBroadcastRecipientInput): Promise<CreateBroadcastRecipientResult> {
    const recipient = await this.prisma.chatBroadcastRecipient.create({
      data: {
        broadcastId: input.broadcastId,
        contactId: input.contactId ?? null,
        clientId: input.clientId ?? null,
        contactInboxId: input.contactInboxId ?? null,
        messageId: input.messageId ?? null,
        status: input.status ?? ChatBroadcastRecipientStatus.PENDING,
      } as any,
      select: { id: true },
    });

    return { id: recipient.id };
  }
}
