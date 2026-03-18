import type { ChatbotInputType, ChatbotStep } from "../../domain/flow";

const EMAIL_REGEX =
  /^[A-Za-z0-9+_.-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

const PHONE_REGEX = /^\+?([\d(). -]){5,20}$/;

export function validateInput(
  step: ChatbotStep,
  value: string,
  interactiveId?: string | null
): { isValid: boolean; parsedValue: unknown } {
  const trimmed = value.trim();
  const inputType = step.inputType ?? "text";

  if (!trimmed && inputType !== "text") {
    return { isValid: false, parsedValue: trimmed };
  }

  if (step.validationPattern) {
    const regex = new RegExp(step.validationPattern);
    return { isValid: regex.test(trimmed), parsedValue: trimmed };
  }

  switch (inputType as ChatbotInputType) {
    case "email":
      return { isValid: EMAIL_REGEX.test(trimmed), parsedValue: trimmed };
    case "phone":
      return { isValid: PHONE_REGEX.test(trimmed), parsedValue: trimmed };
    case "number": {
      const num = Number(trimmed.replace(",", "."));
      return { isValid: !Number.isNaN(num), parsedValue: num };
    }
    case "choice":
    case "buttons": {
      const options = step.options ?? [];
      const patterns = options.map((opt) => opt.pattern);
      if (options.length === 0) return { isValid: true, parsedValue: trimmed };
      const valueMatch = interactiveId
        ? options.some((opt) => opt.value && String(opt.value) === interactiveId)
        : false;
      const match = options.some((opt) => {
        try {
          const regex = new RegExp(opt.pattern, "i");
          return (
            regex.test(trimmed) ||
            (interactiveId ? regex.test(interactiveId) : false)
          );
        } catch {
          return false;
        }
      });
      return {
        isValid: match || valueMatch,
        parsedValue: interactiveId && (match || valueMatch) ? interactiveId : trimmed,
      };
    }
    case "regex": {
      const regex = step.options?.[0]?.pattern;
      if (!regex) return { isValid: true, parsedValue: trimmed };
      return { isValid: new RegExp(regex).test(trimmed), parsedValue: trimmed };
    }
    default:
      return { isValid: true, parsedValue: trimmed };
  }
}
