export function standardizeWaId(waId: string): string {
    const digits = waId.replace(/\D/g, '');

    // Ensure it starts with 55 (Brazil's DDI)
    let standardized = digits.startsWith('55') ? digits : `55${digits}`;

    // Add the 9th digit if it's a Brazilian mobile number missing it
    // Brazilian landlines start with 2-5; mobiles start with 6-9.
    if (standardized.length === 12 && standardized.startsWith('55')) {
        const ddd = standardized.slice(2, 4);
        const firstDigit = standardized.slice(4, 5);

        // If it's a mobile number (starts with 6-9 after DDI+DDD), add the 9
        if (['6', '7', '8', '9'].includes(firstDigit)) {
            standardized = standardized.slice(0, 4) + '9' + standardized.slice(4);
        }
    } else if (standardized.length === 11 && !standardized.startsWith('55')) {
        // Assume it's a Brazilian number without DDI, add DDI
        let brNumber = standardized;
        const ddd = brNumber.slice(0, 2);
        const firstDigit = brNumber.slice(2, 3);

        if (brNumber.length === 10 && ['6', '7', '8', '9'].includes(firstDigit)) {
            brNumber = ddd + '9' + brNumber.slice(2);
        }
        return `55${brNumber}`;
    }

    return standardized;
}
