import type { ChatbotFlowDefinition } from "../../domain/flow";

const DEFAULT_SESSION_TIMEOUT_MINUTES = 1440;

export function getSessionTimeoutMinutes(definition: ChatbotFlowDefinition): number {
  if (definition.sessionTimeoutMinutes && definition.sessionTimeoutMinutes > 0) {
    return definition.sessionTimeoutMinutes;
  }
  return DEFAULT_SESSION_TIMEOUT_MINUTES;
}

export function shouldExpireSession(
  timeoutMinutes: number,
  now: Date,
  lastInteractionAt?: Date | null
): boolean {
  if (!lastInteractionAt) return false;
  const diffMs = now.getTime() - lastInteractionAt.getTime();
  return diffMs > timeoutMinutes * 60 * 1000;
}

export function getMaxStepsPerRun(definition: ChatbotFlowDefinition): number {
  if (definition.maxStepsPerRun && definition.maxStepsPerRun > 0) {
    return definition.maxStepsPerRun;
  }
  return 50;
}

export function getAutoAssignWindowHours(definition: ChatbotFlowDefinition): number {
  if (definition.autoAssignWindowHours && definition.autoAssignWindowHours > 0) {
    return definition.autoAssignWindowHours;
  }
  return 24;
}
