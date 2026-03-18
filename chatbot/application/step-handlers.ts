import type { ChatbotStep, ChatbotFlowDefinition } from "../domain/flow";
import { interpolateDeep, interpolateVariables } from "./utils/variable-parser";

export type StepExecutionResult = {
  nextStepId?: string | null;
  shouldWaitForInput: boolean;
  outgoingMessages: Array<{
    content?: string;
    contentType?: string;
    messageType?: "outgoing" | "template";
    contentAttributes?: {
      ignoreWaitingSince?: boolean;
      items?: Array<{ title: string; value: string; description?: string }>;
      template?: { name: string; languageCode: string; components: any[] };
    };
    attachments?: Array<{
      fileType: string;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    }>;
  }>;
  variableUpdates?: Record<string, unknown>;
  handoff?: boolean;
};

export type ActionDependencies = {
  executeAction: (actionName: string, variables: Record<string, unknown>) => Promise<{
    variableUpdates?: Record<string, unknown>;
    nextStepId?: string | null;
  }>;
};

export function findStep(definition: ChatbotFlowDefinition, stepId?: string | null): ChatbotStep | null {
  if (!stepId) return null;
  return definition.steps.find((step) => step.id === stepId) ?? null;
}

export function resolveNextStepByOptions(
  step: ChatbotStep,
  input: string,
  interactiveId?: string | null
): string | null {
  if (!step.options || step.options.length === 0) return step.nextStepId ?? null;
  for (const option of step.options) {
    const pattern = option.pattern;
    try {
      const regex = new RegExp(pattern, "i");
      if (
        regex.test(input) ||
        (interactiveId ? regex.test(interactiveId) : false) ||
        (option.value ? String(option.value) === interactiveId : false)
      ) {
        return option.nextStepId;
      }
    } catch {
      continue;
    }
  }
  return step.nextStepId ?? null;
}

export async function executeStep(
  step: ChatbotStep,
  variables: Record<string, unknown>,
  dependencies: ActionDependencies
): Promise<StepExecutionResult> {
  const outgoingMessages: StepExecutionResult["outgoingMessages"] = [];
  let nextStepId: string | null | undefined = step.nextStepId ?? null;
  const variableUpdates: Record<string, unknown> = {};

  if (step.type === "message") {
    const content = step.message || step.prompt || "";
    const items = step.items ? interpolateDeep(step.items, variables) : undefined;
    const template = step.template ? interpolateDeep(step.template, variables) : undefined;
    const attachments = step.attachments
      ? interpolateDeep(step.attachments, variables)
      : undefined;
    outgoingMessages.push({
      content: interpolateVariables(content, variables),
      contentType: template
        ? "template"
        : items && items.length > 0
          ? "input_select"
          : "text",
      messageType: template ? "template" : "outgoing",
      contentAttributes: template
        ? { template }
        : items
          ? { items }
          : undefined,
      attachments,
    });
    return { nextStepId, shouldWaitForInput: false, outgoingMessages };
  }

  if (step.type === "send_message") {
    const content = step.action?.message || "";
    const items = step.action?.items
      ? interpolateDeep(step.action.items, variables)
      : undefined;
    const template = step.action?.template
      ? interpolateDeep(step.action.template, variables)
      : undefined;
    const attachments = step.action?.attachments
      ? interpolateDeep(step.action.attachments, variables)
      : undefined;
    outgoingMessages.push({
      content: interpolateVariables(content, variables),
      contentType: template
        ? "template"
        : items && items.length > 0
          ? "input_select"
          : "text",
      messageType: template ? "template" : "outgoing",
      contentAttributes: template
        ? { template }
        : items
          ? { items }
          : undefined,
      attachments,
    });
    return { nextStepId, shouldWaitForInput: false, outgoingMessages };
  }

  if (step.type === "set_variable" && step.action?.key) {
    const rawValue = step.action.value ?? "";
    variableUpdates[step.action.key] = interpolateVariables(rawValue, variables);
    return { nextStepId, shouldWaitForInput: false, outgoingMessages, variableUpdates };
  }

  if (step.type === "input") {
    if (step.prompt || step.items || step.template) {
      const items = step.items ? interpolateDeep(step.items, variables) : undefined;
      const template = step.template ? interpolateDeep(step.template, variables) : undefined;
      const attachments = step.attachments ? interpolateDeep(step.attachments, variables) : undefined;

      outgoingMessages.push({
        content: step.prompt ? interpolateVariables(step.prompt, variables) : "",
        contentType: template
          ? "template"
          : items && items.length > 0
            ? "input_select"
            : "text",
        messageType: template ? "template" : "outgoing",
        contentAttributes: template
          ? { template }
          : items
            ? { items }
            : undefined,
        attachments,
      });
    }
    return { nextStepId, shouldWaitForInput: true, outgoingMessages };
  }

  if (step.type === "action" && step.action?.value) {
    console.log(`[StepHandlers] Executing action: ${step.action.value} for step: ${step.id}`);
    const actionResult = await dependencies.executeAction(step.action.value, variables);
    console.log(`[StepHandlers] Action Result: NextStep=${actionResult.nextStepId}, VarsUpdated=${JSON.stringify(Object.keys(actionResult.variableUpdates || {}))}`);
    if (actionResult.variableUpdates?.proposal_url) {
      console.log(`[StepHandlers] Proposal URL updated: ${actionResult.variableUpdates.proposal_url}`);
    }
    return {
      nextStepId: actionResult.nextStepId ?? nextStepId,
      shouldWaitForInput: false,
      outgoingMessages,
      variableUpdates: actionResult.variableUpdates,
    };
  }

  if (step.type === "condition" && step.condition) {
    const { variable, operator, value } = step.condition;
    const varValue = variables[variable];
    let matched = false;

    switch (operator) {
      case "equals":
        matched = String(varValue) === String(value);
        break;
      case "not_equals":
        matched = String(varValue) !== String(value);
        break;
      case "contains":
        matched = String(varValue).includes(String(value));
        break;
      case "exists":
        matched = varValue !== undefined && varValue !== null && varValue !== "";
        break;
      case "not_exists":
        matched = varValue === undefined || varValue === null || varValue === "";
        break;
    }

    const nextId = matched
      ? step.nextStepId
      : (step.options?.find(o => o.pattern === "else")?.nextStepId ?? null);

    return { nextStepId: nextId, shouldWaitForInput: false, outgoingMessages };
  }

  if (step.type === "webhook") {
    return { nextStepId, shouldWaitForInput: false, outgoingMessages };
  }

  if (step.type === "wait") {
    return { nextStepId, shouldWaitForInput: true, outgoingMessages };
  }

  if (step.type === "handoff") {
    return { nextStepId: null, shouldWaitForInput: false, outgoingMessages: [], handoff: true };
  }

  return { nextStepId, shouldWaitForInput: false, outgoingMessages };
}
