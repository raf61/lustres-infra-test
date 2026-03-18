import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { getBrazilianPhoneAlternatives } from "../utils/brazil-phone";
import { standardizeWaId } from "../utils/standardize-wa-id";

type ContactInput = {
  phoneNumber: string;
  contactName?: string | null;
};

export class BulkEnsureContactsUseCase {
  async execute(contacts: ContactInput[]) {
    const waIds = Array.from(new Set(contacts.map((c) => standardizeWaId(c.phoneNumber))));
    if (waIds.length === 0) {
      return new Map<string, { id: string; waId: string; name: string | null }>();
    }

    // --- Caveat A fix: build alternate lookup ---
    // For each input phoneNumber, compute its Brazilian mobile alternate (with/without 9).
    // This prevents creating duplicate contacts when the same person appears under both forms.
    const alternateOf = new Map<string, string>(); // original → alternate
    for (const waId of waIds) {
      const alts = getBrazilianPhoneAlternatives(waId);
      if (alts.length > 0) alternateOf.set(waId, alts[0]);
    }

    // Search DB for BOTH the original IDs and their alternates in one query.
    const allSearchIds = Array.from(new Set([...waIds, ...alternateOf.values()]));

    const existing = await prisma.chatContact.findMany({
      where: { waId: { in: allSearchIds } },
    });

    const existingMap = new Map(existing.map((c) => [c.waId, c]));
    const inputNameMap = new Map(contacts.map((c) => [c.phoneNumber, c.contactName ?? null]));

    // Only create contacts where NEITHER the original NOR its alternate exists.
    const missing = waIds.filter((waId) => {
      if (existingMap.has(waId)) return false;
      const alt = alternateOf.get(waId);
      return !alt || !existingMap.has(alt);
    });

    if (missing.length > 0) {
      await prisma.chatContact.createMany({
        data: missing.map((waId) => {
          const input = contacts.find((c) => c.phoneNumber === waId);
          return {
            waId,
            name: input?.contactName || waId,
          };
        }),
        skipDuplicates: true,
      });
    }

    // Re-fetch all (original + alternates, including newly created)
    const refreshed = await prisma.chatContact.findMany({
      where: { waId: { in: allSearchIds } },
    });

    // Name updates: same logic as before, but look up the input name via alternate too.
    const nameUpdates: Array<{ waId: string; name: string }> = [];
    for (const contact of refreshed) {
      // Resolve which original input phoneNumber maps to this contact
      const directPhone = inputNameMap.has(contact.waId) ? contact.waId : undefined;
      const altPhone = [...alternateOf.entries()].find(([, alt]) => alt === contact.waId)?.[0];
      const resolvedPhone = directPhone ?? altPhone;
      const inputName = resolvedPhone ? inputNameMap.get(resolvedPhone) : undefined;

      const isUnidentified =
        !contact.name ||
        contact.name === contact.waId ||
        contact.name === `+${contact.waId}`;
      if (isUnidentified && inputName && inputName !== contact.waId) {
        nameUpdates.push({ waId: contact.waId, name: inputName });
      }
    }

    if (nameUpdates.length > 0) {
      const waIdsToUpdate = nameUpdates.map((u) => u.waId);
      const caseClauses = nameUpdates.map((u) => Prisma.sql`WHEN ${u.waId} THEN ${u.name}`);
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "chat_contacts"
        SET "name" = CASE "waId"
          ${Prisma.join(caseClauses, " ")}
        END
        WHERE "waId" IN (${Prisma.join(waIdsToUpdate)})
          AND ("name" IS NULL OR "name" = "waId" OR "name" = CONCAT('+', "waId"))
      `);
    }

    const final = await prisma.chatContact.findMany({
      where: { waId: { in: allSearchIds } },
    });

    const finalMap = new Map(final.map((c) => [c.waId, { id: c.id, waId: c.waId, name: c.name }]));

    // Build result map keyed by original input phoneNumber.
    // If found directly → use that. If found only via alternate → use the alternate's record.
    // This ensures the caller gets a contact record regardless of which 9-variant is in the DB.
    const result = new Map<string, { id: string; waId: string; name: string | null }>();
    for (const waId of waIds) {
      const direct = finalMap.get(waId);
      if (direct) {
        result.set(waId, direct);
      } else {
        const alt = alternateOf.get(waId);
        const viaAlt = alt ? finalMap.get(alt) : undefined;
        if (viaAlt) {
          result.set(waId, viaAlt);
        }
      }
    }

    return result;
  }
}
