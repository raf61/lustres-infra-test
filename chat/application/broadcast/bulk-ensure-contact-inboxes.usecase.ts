import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type ContactInboxInput = {
  contactId: string;
  inboxId: string;
  sourceId: string;
};

export class BulkEnsureContactInboxesUseCase {
  async execute(inputs: ContactInboxInput[]) {
    if (inputs.length === 0) {
      return new Map<string, { id: string; contactId: string; inboxId: string; sourceId: string }>();
    }

    const inboxId = inputs[0]?.inboxId;
    const sourceIds = Array.from(new Set(inputs.map((i) => i.sourceId)));
    const contactIds = Array.from(new Set(inputs.map((i) => i.contactId)));

    const existingBySource = await prisma.chatContactInbox.findMany({
      where: { inboxId, sourceId: { in: sourceIds } },
    });

    const existingByPair = await prisma.chatContactInbox.findMany({
      where: {
        inboxId,
        contactId: { in: contactIds },
      },
    });

    const bySourceMap = new Map(existingBySource.map((c) => [c.sourceId, c]));
    const byPairMap = new Map(existingByPair.map((c) => [`${c.contactId}:${c.inboxId}`, c]));

    const missing = inputs.filter((i) => !bySourceMap.has(i.sourceId));
    if (missing.length > 0) {
      await prisma.chatContactInbox.createMany({
        data: missing.map((i) => ({
          contactId: i.contactId,
          inboxId: i.inboxId,
          sourceId: i.sourceId,
        })),
        skipDuplicates: true,
      });
    }

    const updates: Array<{ id: string; sourceId: string }> = [];
    for (const input of inputs) {
      const key = `${input.contactId}:${input.inboxId}`;
      const existing = byPairMap.get(key);
      if (existing && existing.sourceId !== input.sourceId) {
        updates.push({ id: existing.id, sourceId: input.sourceId });
      }
    }
    if (updates.length > 0) {
      const idsToUpdate = updates.map((u) => u.id);
      const caseClauses = updates.map((u) => Prisma.sql`WHEN ${u.id} THEN ${u.sourceId}`);
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "chat_contact_inboxes"
        SET "sourceId" = CASE "id"
          ${Prisma.join(caseClauses, " ")}
        END
        WHERE "id" IN (${Prisma.join(idsToUpdate)})
      `);
    }

    const refreshed = await prisma.chatContactInbox.findMany({
      where: { inboxId, sourceId: { in: sourceIds } },
    });

    return new Map(
      refreshed.map((c) => [
        c.sourceId,
        { id: c.id, contactId: c.contactId, inboxId: c.inboxId, sourceId: c.sourceId || "" },
      ])
    );
  }
}
