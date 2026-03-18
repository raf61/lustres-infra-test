/**
 * Normalizes a list of contacts for broadcast/chatbot assignment.
 * - Strips non-digits
 * - Adds Brazil country code (55) if missing
 * - Validates length (12–13 digits)
 * - Deduplicates by normalized phoneNumber
 *
 * Shared by BroadcastDispatchUseCase and BulkAssignChatbotUseCase.
 */
export type NormalizeableContact = {
    phoneNumber: string;
    contactName?: string | null;
    clientId?: number | null;
};

export function normalizeContacts<T extends NormalizeableContact>(contacts: T[]): {
    valid: T[];
    invalid: string[];
} {
    const valid: T[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();

    for (const contact of contacts) {
        const rawPhone = contact.phoneNumber;
        const digits = String(rawPhone).replace(/\D/g, "");
        if (!digits) {
            invalid.push(String(rawPhone));
            continue;
        }
        const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
        if (withCountry.length < 12 || withCountry.length > 13) {
            invalid.push(String(rawPhone));
            continue;
        }
        if (seen.has(withCountry)) continue;
        seen.add(withCountry);
        valid.push({ ...contact, phoneNumber: withCountry });
    }

    return { valid, invalid };
}
