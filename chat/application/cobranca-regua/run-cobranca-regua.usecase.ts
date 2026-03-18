import { prisma } from "../../../lib/prisma"
import { createBrazilDateStart, getNowBrazil } from "../../../lib/date-utils"
import { getCobrancaReguaPrepareQueue } from "../../infra/queue/cobranca-regua-prepare.queue"
import { CobrancaReguaRule } from "./rules"
import { PrismaInboxRepository } from "../../infra/repositories/prisma-inbox-repository"
import { ListTemplatesUseCase } from "../list-templates.usecase"

type RunCobrancaReguaResult = {
  totalRules: number
  totalDebitos: number
  totalQueued: number
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const chunkArray = <T,>(items: T[], chunkSize: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

export class RunCobrancaReguaUseCase {
  async execute(rules: CobrancaReguaRule[]): Promise<RunCobrancaReguaResult> {
    console.log(rules)
    if (!rules.length) {
      return { totalRules: 0, totalDebitos: 0, totalQueued: 0 }
    }

    const inboxRepository = new PrismaInboxRepository()
    const listTemplatesUseCase = new ListTemplatesUseCase(inboxRepository)
    const templatesByInbox = new Map<
      string,
      Map<
        string,
        { language: string; components: any[]; parameterFormat?: "POSITIONAL" | "NAMED" | undefined }
      >
    >()

    const { year, month, day } = getNowBrazil()
    const todayStart = createBrazilDateStart(year, month, day)
    const queue = getCobrancaReguaPrepareQueue()

    let totalDebitos = 0
    let totalQueued = 0

    for (const rule of rules) {
      if (!templatesByInbox.has(rule.inboxId)) {
        const listResult = await listTemplatesUseCase.execute(rule.inboxId)
        const map = new Map<
          string,
          { language: string; components: any[]; parameterFormat?: "POSITIONAL" | "NAMED" | undefined }
        >()
        for (const template of listResult.templates) {
          map.set(template.name, {
            language: template.language,
            components: template.components,
            parameterFormat: template.parameter_format,
          })
        }
        templatesByInbox.set(rule.inboxId, map)
      }

      const templatesMap = templatesByInbox.get(rule.inboxId)
      const templateMeta = templatesMap?.get(rule.templateName)
      if (!templateMeta) {
        console.warn(
          `[CobrancaRegua] Template "${rule.templateName}" não encontrado para inbox ${rule.inboxId}`,
        )
        continue
      }

      const sendComponents = buildTemplateComponents(rule, templateMeta)

      // Usa UTC meia-noite como start para cobrir o dia inteiro.
      // createBrazilDateStart retorna 00:00:00-03:00 = 03:00Z em UTC, o que exclui
      // débitos salvos como 00:00:00Z (meia-noite UTC). Subtraindo 3h, cobrimos o dia todo.
      const startBrazil = addDays(todayStart, rule.offsetStartDays)
      const start = new Date(startBrazil.getTime() - 3 * 60 * 60 * 1000)
      const endBrazil = addDays(todayStart, rule.offsetEndDays + 1)
      const endExclusive = new Date(endBrazil.getTime() - 3 * 60 * 60 * 1000)

      console.log(`[CobrancaRegua] rule=${rule.key} start=${start.toISOString()} end=${endExclusive.toISOString()}`)

      const debitos = await prisma.debito.findMany({
        where: {
          stats: 0,
          vencimento: {
            gte: start,
            lt: endExclusive,
          },
        },
        select: {
          id: true,
          clienteId: true,
        },
      })

      console.log(`[CobrancaRegua] rule=${rule.key} → ${debitos.length} débito(s) encontrado(s)`)

      if (!debitos.length) continue

      totalDebitos += debitos.length

      // Filtra apenas os que já foram enviados com sucesso (QUEUED ou SENT).
      // Débitos com status FAILED ou SKIPPED devem ser reprocessados.
      const existing = await prisma.cobrancaCampanhaEnvio.findMany({
        where: {
          debitoId: { in: debitos.map((d) => d.id) },
          ruleKey: rule.key,
          status: { in: ["QUEUED", "SENT"] },
        },
        select: { debitoId: true },
      })

      const existingSet = new Set(existing.map((item) => item.debitoId))
      const pendingDebitos = debitos.filter((d) => !existingSet.has(d.id))

      console.log(`[CobrancaRegua] rule=${rule.key} → ${existing.length} já enviado(s), ${pendingDebitos.length} pendente(s) para enfileirar`)

      if (!pendingDebitos.length) continue

      await prisma.cobrancaCampanhaEnvio.createMany({
        data: pendingDebitos.map((d) => ({
          debitoId: d.id,
          clienteId: d.clienteId,
          status: "QUEUED",
          ruleKey: rule.key,
        })),
        skipDuplicates: true,
      })

      const debitoIds = pendingDebitos.map((d) => d.id)
      const chunks = chunkArray(debitoIds, 500)

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        await queue.add(
          `cobranca-regua-prepare-${rule.key}-${start.toISOString().slice(0, 10)}-chunk${i}`,
          {
            ruleKey: rule.key,
            inboxId: rule.inboxId,
            assigneeId: process.env.COBRANCA_REGUA_ASSIGNEE_ID || null,
            debitoIds: chunk,
            template: {
              name: rule.templateName,
              languageCode: templateMeta.language,
              components: sendComponents,
            },
          },
          {
            removeOnComplete: true,
            removeOnFail: false,
          },
        )
        totalQueued += chunk.length
      }
    }

    return {
      totalRules: rules.length,
      totalDebitos,
      totalQueued,
    }
  }
}

const buildTemplateComponents = (
  rule: CobrancaReguaRule,
  templateMeta: { components: any[]; parameterFormat?: "POSITIONAL" | "NAMED" | undefined },
) => {
  const components: any[] = []
  const params = rule.parameters || {}
  const isNamedTemplate = templateMeta.parameterFormat === "NAMED"

  const getNamedParamsFor = (component: any, kind: "body" | "header"): string[] => {
    const example = component?.example
    if (!example) return []
    if (kind === "body") {
      const arr = example.body_text_named_params
      return Array.isArray(arr) && Array.isArray(arr[0]) ? arr[0].map((s: unknown) => String(s)) : []
    }
    const arr = example.header_text_named_params
    return Array.isArray(arr) && Array.isArray(arr[0]) ? arr[0].map((s: unknown) => String(s)) : []
  }

  for (const component of templateMeta.components || []) {
    if (component.type === "HEADER") {
      if (component.format === "DOCUMENT" && params.headerDocument?.linkToken) {
        const document: { link: string; filename?: string } = {
          link: params.headerDocument.linkToken,
        }
        if (params.headerDocument.filenameToken) {
          document.filename = params.headerDocument.filenameToken
        }
        components.push({
          type: "header",
          parameters: [{ type: "document", document }],
        })
      } else if (component.format === "TEXT" && params.headerTextTokens?.length) {
        const headerNamedParams = isNamedTemplate
          ? (params.headerTextParamNames?.length
            ? params.headerTextParamNames
            : getNamedParamsFor(component, "header"))
          : []
        components.push({
          type: "header",
          parameters: params.headerTextTokens.map((text, index) => ({
            type: "text",
            text,
            ...(isNamedTemplate
              ? { parameter_name: headerNamedParams[index] ?? `header_${index + 1}` }
              : {}),
          })),
        })
      } else if (["IMAGE", "VIDEO"].includes(component.format) && params.headerMedia?.linkToken) {
        const mediaType = component.format.toLowerCase()
        components.push({
          type: "header",
          parameters: [
            {
              type: mediaType,
              [mediaType]: { link: params.headerMedia.linkToken },
            },
          ],
        })
      }
    }

    if (component.type === "BODY" && params.bodyTextTokens?.length) {
      const bodyNamedParams = isNamedTemplate
        ? (params.bodyTextParamNames?.length ? params.bodyTextParamNames : getNamedParamsFor(component, "body"))
        : []
      components.push({
        type: "body",
        parameters: params.bodyTextTokens.map((text, index) => ({
          type: "text",
          text,
          ...(isNamedTemplate ? { parameter_name: bodyNamedParams[index] ?? `body_${index + 1}` } : {}),
        })),
      })
    }

    if (component.type === "BUTTONS" && Array.isArray(component.buttons) && params.buttonTextTokens?.length) {
      component.buttons.forEach((button: any, index: number) => {
        const token = params.buttonTextTokens?.[index]
        if (!token) return
        if (button.type === "URL") {
          components.push({
            type: "button",
            sub_type: "url",
            index,
            parameters: [{ type: "text", text: token }],
          })
        }
      })
    }
  }

  return components
}


