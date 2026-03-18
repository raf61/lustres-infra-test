import type { ChatbotFlowDefinition, ChatbotStep } from "../../domain/flow";

export function findFirstInputStepId(definition: ChatbotFlowDefinition): string | null {
  const inputStep = definition.steps.find((step) => step.type === "input");
  return inputStep?.id ?? null;
}

export function getStartStep(definition: ChatbotFlowDefinition): ChatbotStep | null {
  const startId = definition.startStepId ?? definition.steps[0]?.id;
  if (!startId) return null;
  return definition.steps.find((step) => step.id === startId) ?? null;
}

export function applyTemplateOverride(
  definition: ChatbotFlowDefinition,
  template: ChatbotStep["template"]
): ChatbotFlowDefinition {
  if (!template) return definition;
  if (!definition.steps || definition.steps.length === 0) return definition;
  const startId = definition.startStepId ?? definition.steps[0]?.id;
  if (!startId) return definition;

  let updated = false;
  const steps = definition.steps.map((step) => {
    if (step.id !== startId) return step;
    if (step.template || step.type === "message" || step.type === "send_message") {
      updated = true;
      return { ...step, template };
    }
    return step;
  });

  if (!updated) return definition;
  return { ...definition, steps };
}
