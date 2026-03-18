import { Prisma } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "../../../lib/prisma";
import { getBroadcastsQueue } from "../../infra/queue/broadcasts.queue";

type ConversationSeed = {
  inboxId: string;
  phoneNumber: string;
  contactId: string;
  contactName?: string | null;
};

export class BulkEnsureConversationsUseCase {
  async execute(
    seeds: ConversationSeed[]
  ): Promise<
    Map<
      string,
      { id: string; contactId: string; inboxId: string; assigneeId?: string | null }
    >
  > {
    if (seeds.length === 0) {
      return new Map<string, { id: string; contactId: string; inboxId: string }>();
    }

    const inboxId = seeds[0]?.inboxId;
    const contactIds = Array.from(new Set(seeds.map((s) => s.contactId)));
    console.log(`[BulkEnsureConversations] Checking for ${contactIds.length} unique contactIds in inbox ${inboxId}`);

    // Buscar todas as conversas para esses contatos nesta inbox
    const allExisting = await prisma.chatConversation.findMany({
      where: {
        inboxId,
        contactId: { in: contactIds },
      },
      orderBy: { createdAt: "desc" },
    });

    // Mapear apenas a conversa mais recente por contato
    const conversationMap = new Map<string, any>();
    for (const conv of allExisting) {
      if (!conversationMap.has(conv.contactId)) {
        conversationMap.set(conv.contactId, conv);
      }
    }

    console.log(`[BulkEnsureConversations] Existing conversations found: ${conversationMap.size}`);

    const missing = seeds.filter((seed) => !conversationMap.has(seed.contactId));
    console.log(`[BulkEnsureConversations] Missing conversations to create: ${missing.length}`);

    if (missing.length > 0) {
      const values = missing.map((seed) =>
        Prisma.sql`(${createId()}::text, ${seed.inboxId}::text, ${seed.contactId}::text)`
      );

      console.log(`[BulkEnsureConversations] Inserting ${missing.length} missing conversations...`);
      const inserted = await prisma.$queryRaw<
        Array<{
          id: string;
          contactId: string;
          inboxId: string;
          status: string;
          assigneeId: string | null;
        }>
      >(Prisma.sql`
        INSERT INTO "chat_conversations" (
          "id",
          "inboxId",
          "contactId",
          "status",
          "lastActivityAt",
          "createdAt",
          "updatedAt"
        )
        SELECT v."id", v."inboxId", v."contactId", 'open', NOW(), NOW(), NOW()
        FROM (VALUES ${Prisma.join(values)}) AS v("id", "inboxId", "contactId")
        WHERE NOT EXISTS (
          SELECT 1
          FROM "chat_conversations" c
          WHERE c."contactId" = v."contactId"
            AND c."inboxId" = v."inboxId"
        )
        RETURNING "id", "contactId", "inboxId", "status", "assigneeId"
      `);

      console.log(`[BulkEnsureConversations] Inserted ${inserted.length} new records`);

      if (inserted.length > 0) {
        const queue = getBroadcastsQueue();
        const baseTs = Date.now();
        await queue.addBulk(
          inserted.map((conv, index) => ({
            name: "conversation.created",
            data: {
              type: "conversation.created",
              payload: {
                id: conv.id,
                contactId: conv.contactId,
                inboxId: conv.inboxId,
                status: conv.status,
              },
              timestamp: new Date().toISOString(),
            },
            opts: {
              jobId: `conversation.created-${conv.id}-${baseTs + index}`,
            },
          }))
        );

        // Adicionar as recém-criadas ao mapa
        for (const conv of inserted) {
          conversationMap.set(conv.contactId, conv);
        }
      }
    }

    console.log(`[BulkEnsureConversations] Final valid map count: ${conversationMap.size}`);

    return new Map(
      seeds.map((seed) => {
        const conv = conversationMap.get(seed.contactId);
        return [
          seed.contactId,
          {
            id: conv?.id || "",
            contactId: seed.contactId,
            inboxId: seed.inboxId,
            assigneeId: conv?.assigneeId ?? null,
          }
        ];
      })
    );
  }
}
