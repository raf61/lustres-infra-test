import { prisma } from "../../../lib/prisma";
import type { IChatbotInboxDefaultRepository } from "../../domain/repositories/inbox-default-repository";

export class PrismaChatbotInboxDefaultRepository implements IChatbotInboxDefaultRepository {
  async findDefaultByInbox(
    inboxId: string
  ): Promise<{ flowId: string; active: boolean } | null> {
    const record = await prisma.chatInboxBotDefault.findUnique({
      where: { inboxId },
      select: { flowId: true, active: true },
    });
    if (!record) return null;
    return { flowId: record.flowId, active: record.active };
  }
}
