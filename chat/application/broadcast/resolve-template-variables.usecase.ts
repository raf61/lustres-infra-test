import { PrismaClient } from "@prisma/client";

type TemplatePayload = {
  name: string;
  languageCode: string;
  components: Array<Record<string, unknown>>;
};

export type ResolveTemplateVariablesInput = {
  template: TemplatePayload;
  context: {
    clientId?: number | null;
    contactId?: string | null;
    contactName?: string | null;
    phoneNumber?: string | null;
  };
};

export class ResolveTemplateVariablesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ResolveTemplateVariablesInput): Promise<TemplatePayload> {
    const { template, context } = input;
    const tokens = await this.buildTokenMap(context);

    if (template.components.length === 0) {
      return template;
    }

    const components = template.components.map((component) =>
      this.replaceTokensDeep(component, tokens),
    );

    return {
      ...template,
      components,
    };
  }

  private async buildTokenMap(context: ResolveTemplateVariablesInput["context"]) {
    const [client, contact] = await Promise.all([
      context.clientId
        ? this.prisma.client.findUnique({
            where: { id: context.clientId },
            select: {
              razaoSocial: true,
              cnpj: true,
              telefoneCondominio: true,
              celularCondominio: true,
              nomeSindico: true,
              telefoneSindico: true,
              logradouro: true,
              numero: true,
              complemento: true,
              bairro: true,
              cidade: true,
              estado: true,
              cep: true,
            },
          })
        : null,
      context.contactId
        ? this.prisma.chatContact.findUnique({
            where: { id: context.contactId },
            select: { name: true, waId: true },
          })
        : null,
    ]);

    const contactName = context.contactName ?? contact?.name ?? null;
    const phone = context.phoneNumber ?? contact?.waId ?? null;

    return {
      "client.razaoSocial": client?.razaoSocial ?? undefined,
      "client.cnpj": client?.cnpj ?? undefined,
      "client.telefoneCondominio": client?.telefoneCondominio ?? undefined,
      "client.celularCondominio": client?.celularCondominio ?? undefined,
      "client.nomeSindico": client?.nomeSindico ?? undefined,
      "client.telefoneSindico": client?.telefoneSindico ?? undefined,
      "client.logradouro": client?.logradouro ?? undefined,
      "client.numero": client?.numero ?? undefined,
      "client.complemento": client?.complemento ?? undefined,
      "client.bairro": client?.bairro ?? undefined,
      "client.cidade": client?.cidade ?? undefined,
      "client.estado": client?.estado ?? undefined,
      "client.cep": client?.cep ?? undefined,
      "contact.name": contactName ?? undefined,
      "contact.waId": contact?.waId ?? undefined,
      "phone": phone ?? undefined,
    } as Record<string, string | undefined>;
  }

  private replaceTokensDeep(value: unknown, tokens: Record<string, string | undefined>): any {
    if (typeof value === "string") {
      return this.replaceTokens(value, tokens);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.replaceTokensDeep(item, tokens));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, this.replaceTokensDeep(val, tokens)]),
      );
    }

    return value;
  }

  private replaceTokens(text: string, tokens: Record<string, string | undefined>) {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      const value = tokens[key];
      if (!value) return match;
      return value;
    });
  }
}

