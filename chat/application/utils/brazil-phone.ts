/**
 * Generates Brazilian WhatsApp phone number alternatives for the 9th-digit variation.
 *
 * Brazil's mobile numbering went through an expansion where an extra '9' was added
 * after the DDD prefix. As a result, the same person may appear as:
 *   - 55 + DDD(2) + 9 + 8 digits = 13 digits total  (new format, post-~2012)
 *   - 55 + DDD(2) + 8 digits     = 12 digits total  (old format)
 *
 * The function returns the alternate form(s) for a given number, or an empty array
 * if the number is not a recognisable Brazilian mobile.
 *
 * @param phone - Raw phone string (digits only).  e.g. "5521999110013"
 * @returns Array with 0 or 1 alternate forms.
 */
export function getBrazilianPhoneAlternatives(phone: string): string[] {
    const digits = phone.replace(/\D/g, "");
    if (!digits.startsWith("55")) return [];

    const rest = digits.slice(2);

    if (rest.length === 10) {
        // Format: 55 + DDD(2) + 8 local digits (old mobile format — no leading 9).
        const ddd = rest.slice(0, 2);
        const local = rest.slice(2); // 8 digits

        // Brazilian landlines start with 2–5; mobiles start with 6–9.
        // Only add the extra 9 for mobile numbers to avoid false positives on landlines.
        if (/^[6-9]/.test(local)) {
            return [`55${ddd}9${local}`];
        }
        return [];
    }

    if (rest.length === 11) {
        // Format: 55 + DDD(2) + 9 + 8 local digits (new mobile format).
        const ddd = rest.slice(0, 2);
        const maybeNine = rest.slice(2, 3);
        const local = rest.slice(3); // 8 digits after the 9
        if (maybeNine === "9" && local.length === 8) {
            return [`55${ddd}${local}`];
        }
    }

    return [];
}
