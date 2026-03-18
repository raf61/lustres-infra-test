import { ChatBroadcastStatus, PrismaClient } from "@prisma/client";

export type CreateBroadcastInput = {
  inboxId: string;
  createdById: string;
  name?: string | null;
  status?: ChatBroadcastStatus;
};

export type CreateBroadcastResult = {
  id: string;
};

export class CreateBroadcastUseCase {
  constructor(private readonly prisma: PrismaClient) { }

  async execute(input: CreateBroadcastInput): Promise<CreateBroadcastResult> {
    const broadcast = await this.prisma.chatBroadcast.create({
      data: {
        inboxId: input.inboxId,
        createdById: input.createdById,
        name: input.name,
        status: input.status ?? ChatBroadcastStatus.QUEUED,
      } as any,
      select: { id: true },
    });

    return { id: broadcast.id };
  }
}
