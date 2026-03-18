import type { IChatbotFlowRepository } from "../domain/repositories/flow-repository";
import type { ChatbotFlowDefinition } from "../domain/flow";
import { getStartStep } from "./utils/flow-utils";

type OutboundTemplateResult = {
  name: string;
  languageCode: string;
  components: any[];
};

export class ResolveOutboundTemplateUseCase {
  constructor(private readonly flowRepository: IChatbotFlowRepository) {}

  async execute(flowId: string): Promise<OutboundTemplateResult | null> {
    const flow = await this.flowRepository.findById(flowId);
    if (!flow || !flow.active || flow.type !== "OUTBOUND") return null;

    const definition = this.normalizeDefinition(flow.definition);
    const startStep = getStartStep(definition);
    if (!startStep) return null;

    const template = startStep.template ?? startStep.action?.template;
    if (!template?.name || !template.languageCode) return null;

    return template;
  }

  private normalizeDefinition(definition: ChatbotFlowDefinition | any): ChatbotFlowDefinition {
    if (definition?.definition?.steps) {
      return definition.definition as ChatbotFlowDefinition;
    }
    return definition as ChatbotFlowDefinition;
  }
}
