export function interpolateVariables(
  text: string,
  variables: Record<string, unknown>
): string {
  // Regex mais robusto: aceita {{key}}, {{ vars.key }}, {{  vars.key_name  }}, etc.
  return text.replace(/\{\{\s*(?:vars\.)?([\w.-]+)\s*\}\}/gi, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

export function interpolateDeep<T>(
  value: T,
  variables: Record<string, unknown>
): T {
  if (typeof value === "string") {
    return interpolateVariables(value, variables) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateDeep(item, variables)) as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      result[key] = interpolateDeep(val, variables);
    });
    return result as T;
  }
  return value;
}
