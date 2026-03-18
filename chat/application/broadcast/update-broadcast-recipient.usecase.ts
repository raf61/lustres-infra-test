import { ChatBroadcastRecipientStatus, PrismaClient } from "@prisma/client";

export type UpdateBroadcastRecipientInput = {
  recipientId?: string;
  messageId?: string;
  status?: ChatBroadcastRecipientStatus;
};

export class UpdateBroadcastRecipientUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: UpdateBroadcastRecipientInput): Promise<void> {
    if (!input.recipientId && !input.messageId) {
      throw new Error("recipientId or messageId is required");
    }

    const data: { status?: ChatBroadcastRecipientStatus; messageId?: string } = {};
    if (input.status) data.status = input.status;
    if (input.messageId && input.recipientId) data.messageId = input.messageId;

    if (input.recipientId) {
      await this.prisma.chatBroadcastRecipient.update({
        where: { id: input.recipientId },
        data,
      });
      return;
    }

    await this.prisma.chatBroadcastRecipient.updateMany({
      where: { messageId: input.messageId ?? undefined },
      data,
    });
  }
}

