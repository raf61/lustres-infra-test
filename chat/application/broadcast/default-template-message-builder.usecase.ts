import { PrismaClient } from "@prisma/client";
import {
  BroadcastMessageBuildInput,
  BroadcastMessageBuilder,
  BroadcastMessageDraft,
} from "./broadcast-message-builder";
import { ResolveTemplateVariablesUseCase } from "./resolve-template-variables.usecase";

export class DefaultTemplateBroadcastMessageBuilderUseCase implements BroadcastMessageBuilder {
  private readonly resolver: ResolveTemplateVariablesUseCase;

  constructor(prisma: PrismaClient) {
    this.resolver = new ResolveTemplateVariablesUseCase(prisma);
  }

  async build(input: BroadcastMessageBuildInput): Promise<BroadcastMessageDraft> {
    const { baseMessage, contact } = input;

    if (!baseMessage.contentAttributes?.template) {
      return baseMessage;
    }

    const resolvedTemplate = await this.resolver.execute({
      template: baseMessage.contentAttributes.template,
      context: {
        clientId: contact.clientId ?? null,
        contactId: contact.contactId ?? null,
        contactName: contact.contactName ?? null,
        phoneNumber: contact.phoneNumber ?? null,
      },
    });

    return {
      ...baseMessage,
      contentAttributes: {
        ...baseMessage.contentAttributes,
        template: resolvedTemplate,
      },
    };
  }
}

