import "dotenv/config"
import fs from "fs"
import PDFMerger from "pdf-merger-js"

import { prisma } from "../lib/prisma"
import { storage } from "../lib/storage"
import { generateItauBoletoPdf, generateSantanderBoletoPdf } from "../lib/boleto"

import { PrismaContactRepository } from "../chat/infra/repositories/prisma-contact-repository"
import { PrismaContactInboxRepository } from "../chat/infra/repositories/prisma-contact-inbox-repository"
import { PrismaConversationRepository } from "../chat/infra/repositories/prisma-conversation-repository"
import { PrismaInboxRepository } from "../chat/infra/repositories/prisma-inbox-repository"
import { PrismaMessageRepository } from "../chat/infra/repositories/prisma-message-repository"
import { getBullMQBroadcaster } from "../chat/infra/events/bullmq-broadcaster"
import { getChatEventsQueue } from "../chat/infra/queue/chat-events.queue"
import { CreateConversationUseCase } from "../chat/application/create-conversation.usecase"
import { CreatePendingMessageUseCase } from "../chat/application/create-pending-message.usecase"
import { SendMessageUseCase } from "../chat/application/send-message.usecase"
import { ListTemplatesUseCase } from "../chat/application/list-templates.usecase"
import { getCobrancaReguaSendQueue } from "../chat/infra/queue/cobranca-regua-send.queue"
import { PrismaClientChatContactRepository } from "../chat/infra/repositories/prisma-client-chat-contact-repository"

// HARD-CODED (você disse que vai mudar depois)
const INBOX_ID = "cmlv70gpm0000jy04rehmgjph"
const TEMPLATE_NAME = "cobranca_pagamentos_1"
const SKIP_CLIENT_IDS = new Set<number>([8112])

type Args = {
  execute: boolean
  ruleKey: string
  assigneeId: string | null
  limitClients: number | null
  offsetClients: number
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const formatDate = (value: Date | null) => {
  if (!value) return ""
  return value.toLocaleDateString("pt-BR")
}

const replaceTokens = (text: string, tokens: Record<string, string>) => {
  return Object.entries(tokens).reduce((acc, [key, value]) => acc.split(key).join(value), text)
}

const applyTokens = (input: any, tokens: Record<string, string>): any => {
  if (typeof input === "string") return replaceTokens(input, tokens)
  if (Array.isArray(input)) return input.map((item) => applyTokens(item, tokens))
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, applyTokens(value, tokens)]),
    )
  }
  return input
}

const normalizeWhatsappNumber = (value: string) => {
  const digits = value.replace(/\D+/g, "")
  if (!digits) return ""
  if (digits.startsWith("55")) return digits
  return `55${digits}`
}

const resolvePreferredPhone = (cliente: {
  telefoneSindico?: string | null
  telefoneCondominio?: string | null
  celularCondominio?: string | null
  chatContacts?: Array<{ contact: { waId: string | null } }>
}) => {
  const fromSindico = cliente.telefoneSindico?.trim()
  if (fromSindico) return normalizeWhatsappNumber(fromSindico)

  const chatContact = cliente.chatContacts?.find((item) => item.contact.waId)?.contact.waId
  if (chatContact) return normalizeWhatsappNumber(chatContact)

  const celular = cliente.celularCondominio?.trim()
  if (celular) return normalizeWhatsappNumber(celular)

  const telefone = cliente.telefoneCondominio?.trim()
  if (telefone) return normalizeWhatsappNumber(telefone)

  return null
}

function parseArgs(argv: string[]): Args {
  const now = new Date()
  const defaultRuleKey = `manual_blast_${now.toISOString().replace(/[:.]/g, "-")}`

  const args: Args = {
    execute: false,
    ruleKey: defaultRuleKey,
    assigneeId: null,
    limitClients: null,
    offsetClients: 50,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--execute") args.execute = true
    if (a === "--rule-key") args.ruleKey = String(argv[++i] || "")
    if (a === "--assignee-id") args.assigneeId = String(argv[++i] || "")
    if (a === "--limit-clients") args.limitClients = Number(argv[++i] || "")
    if (a === "--limit") args.limitClients = Number(argv[++i] || "")
    if (a === "--offset") args.offsetClients = Number(argv[++i] || "")
  }

  if (args.limitClients !== null && (!Number.isFinite(args.limitClients) || args.limitClients <= 0)) {
    args.limitClients = null
  }

  if (!Number.isFinite(args.offsetClients) || args.offsetClients < 0) {
    args.offsetClients = 0
  }

  return args
}

type TemplateMeta = {
  language: string
  components: any[]
  parameterFormat?: "POSITIONAL" | "NAMED"
  namedBodyParams?: string[]
}
type CobrancaRuleLike = {
  parameters?: {
    headerDocument?: { linkToken: string; filenameToken?: string }
    headerTextTokens?: string[]
    bodyTextTokens?: string[]
    buttonTextTokens?: string[]
  }
}

function getBodyExampleParamCount(templateMeta: any): number | null {
  const body = (templateMeta?.components || []).find((c: any) => c?.type === "BODY")
  const example = body?.example?.body_text
  if (Array.isArray(example) && Array.isArray(example[0])) {
    return example[0].length
  }
  return null
}

function getBodyNamedParamNames(templateMeta: any): string[] {
  const body = (templateMeta?.components || []).find((c: any) => c?.type === "BODY")
  const named = body?.example?.body_text_named_params
  if (!Array.isArray(named)) return []
  return named.map((p: any) => String(p?.param_name || "")).filter((s: string) => s.length > 0)
}

function assertTemplateCompatible(templateMeta: any) {
  const header = (templateMeta?.components || []).find((c: any) => c?.type === "HEADER")
  const headerFormat = header?.format
  if (headerFormat !== "DOCUMENT") {
    throw new Error(
      `Template "${TEMPLATE_NAME}" inválido: HEADER precisa ser DOCUMENT (atual: ${String(headerFormat || "none")}).`,
    )
  }

  // Para templates NAMED, validar se temos 4 param_names no exemplo (quando existe)
  const namedParams = getBodyNamedParamNames(templateMeta)
  const paramFormat = String(templateMeta?.parameter_format || "").toUpperCase()
  if (paramFormat === "NAMED" && namedParams.length > 0 && namedParams.length !== 4) {
    throw new Error(
      `Template "${TEMPLATE_NAME}" inválido: BODY named params tem ${namedParams.length}; esperado 4.`,
    )
  }

  const expectedBodyParams = getBodyExampleParamCount(templateMeta)
  if (expectedBodyParams !== null && expectedBodyParams !== 4) {
    throw new Error(
      `Template "${TEMPLATE_NAME}" inválido: BODY example tem ${expectedBodyParams} parâmetros; esperado 4 (nome_contato, nome_condominio, nome_empresa, nome_cobrador).`,
    )
  }
}

function safePdfFilename(clientId: number) {
  return `Boletos-${clientId}.pdf`
}

function buildTemplateComponents(rule: CobrancaRuleLike, templateMeta: TemplateMeta) {
  const components: any[] = []
  const params = rule.parameters || {}
  const isNamedTemplate = templateMeta.parameterFormat === "NAMED"

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
        components.push({
          type: "header",
          parameters: params.headerTextTokens.map((text, index) => ({
            type: "text",
            text,
            ...(isNamedTemplate ? { parameter_name: `header_${index + 1}` } : {}),
          })),
        })
      }
    }

    if (component.type === "BODY" && params.bodyTextTokens?.length) {
      components.push({
        type: "body",
        parameters: params.bodyTextTokens.map((text, index) => ({
          type: "text",
          text,
          ...(isNamedTemplate
            ? { parameter_name: templateMeta.namedBodyParams?.[index] || `body_${index + 1}` }
            : {}),
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

type DebitoRow = Awaited<ReturnType<typeof loadDebitos>>[number]

async function loadDebitos(args: Args) {
  const now = new Date()
  const where: any = {
    stats: 0,
    vencimento: { lt: now },
  }

  return prisma.debito.findMany({
    where,
    include: {
      cliente: {
        select: {
          id: true,
          razaoSocial: true,
          cnpj: true,
          nomeSindico: true,
          telefoneSindico: true,
          cep: true,
          cidade: true,
          estado: true,
          logradouro: true,
          numero: true,
          bairro: true,
          complemento: true,
          celularCondominio: true,
          telefoneCondominio: true,
          chatContacts: {
            select: { contact: { select: { id: true, waId: true, name: true } } },
          },
        },
      },
      pedido: {
        select: {
          bancoEmissorId: true,
          legacyEmpresaFaturamento: true,
          orcamento: {
            select: {
              empresa: { select: { id: true, nome: true } },
            },
          },
          bancoEmissor: {
            select: {
              bancoCodigo: true,
              razaoSocial: true,
              cnpj: true,
              agencia: true,
              agenciaDigito: true,
              conta: true,
              contaDigito: true,
              carteira: true,
              codigoBeneficiario: true,
              endereco: true,
            },
          },
        },
      },
    },
    orderBy: [{ clienteId: "asc" }, { vencimento: "asc" }],
  })
}

const mergePdfBuffers = async (buffers: Buffer[]) => {
  const merger = new PDFMerger()
  for (const buffer of buffers) {
    await merger.add(buffer)
  }
  return merger.saveAsBuffer()
}

async function generateBoletoPdfBuffer(debito: DebitoRow): Promise<Buffer> {
  const banco = debito.pedido?.bancoEmissor
  if (!banco || !debito.pedido?.bancoEmissorId) {
    throw new Error("Banco emissor não associado ao débito.")
  }
  if (![341, 33].includes(banco.bancoCodigo)) {
    throw new Error("Banco não suportado para geração de boleto.")
  }

  const cliente = debito.cliente
  if (!cliente) {
    throw new Error("Cliente não encontrado.")
  }

  const enderecoBanco = banco.endereco || ""
  const codigoBeneficiario = banco.codigoBeneficiario || ""

  const sacado = {
    nome: cliente.razaoSocial ?? "",
    cnpj: cliente.cnpj ?? undefined,
    logradouro: [cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(" ") || "",
    bairro: cliente.bairro ?? "",
    cidade: cliente.cidade ?? "",
    uf: cliente.estado ?? "",
    cep: cliente.cep ?? "",
  }
  const cedente = {
    razaoSocial: banco.razaoSocial,
    cnpj: banco.cnpj,
    agencia: banco.agencia || "",
    agenciaDigito: banco.agenciaDigito || "",
    conta: banco.conta || "",
    contaDigito: banco.contaDigito || "",
    carteira: banco.carteira,
    codigoBeneficiario,
    endereco: enderecoBanco,
  }

  const valorTitulo = Number(debito.receber ?? 0)
  if (!valorTitulo || Number.isNaN(valorTitulo) || valorTitulo <= 0 || !debito.vencimento) {
    throw new Error("Valor ou vencimento inválido para emissão de boleto.")
  }
  const titulo = {
    nossoNumero: debito.id,
    numeroDocumento: debito.id.toString(),
    valor: valorTitulo,
    vencimento: debito.vencimento,
    emissao: new Date(),
    multaFixa: 15.49,
    jurosMora: Math.floor((valorTitulo * 1.99 * 100) / 100) / 100,
    mensagem1: "ATENÇÃO: NÃO RECONHECEMOS BOLETOS ATUALIZADOS PELA INTERNET.",
    mensagem2: `APOS O VENCIMENTO COBRAR MULTA R$ 15,49 E MORA DE 1,99% AO DIA`,
  }

  let filePath = ""
  if (banco.bancoCodigo === 341) {
    const result = await generateItauBoletoPdf({
      cedente,
      sacado,
      titulo,
      destinoDir: "/tmp",
      nomeArquivo: `boleto-itau-${debito.id}`,
    })
    filePath = result.filePath
  } else {
    const result = await generateSantanderBoletoPdf({
      cedente,
      sacado,
      titulo,
      destinoDir: "/tmp",
      nomeArquivo: `boleto-santander-${debito.id}`,
    })
    filePath = result.filePath
  }

  return fs.readFileSync(filePath)
}

type CompanyProfile = {
  empresaId: 1 | 2 | null
  nomeEmpresa: string
  nomeCobrador: string
}

function resolveEmpresaId(debito: DebitoRow): number | null {
  const empresa = debito.pedido?.orcamento?.empresa ?? null
  if (empresa?.id) return empresa.id
  return null
}

function pickCompanyProfile(debitos: DebitoRow[]): CompanyProfile {
  const counts = new Map<number, number>()
  for (const d of debitos) {
    const id = resolveEmpresaId(d)
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  const topId = sorted[0]?.[0] ?? null

  if (sorted.length > 1) {
    console.warn("[cobranca-blast] cliente com débitos de múltiplas empresas; usando a mais frequente:", sorted)
  }

  if (topId === 1) {
    return {
      empresaId: 1,
      nomeEmpresa: "Empresa Brasileira de Raios",
      nomeCobrador: "Sistema de Cobranças Assertivas",
    }
  }
  if (topId === 2) {
    return {
      empresaId: 2,
      nomeEmpresa: "Franklin Instalações de Para-raios",
      nomeCobrador: "Franklin Instalações de Para-raios",
    }
  }

  const legacy = debitos.find((d) => d.pedido?.legacyEmpresaFaturamento)?.pedido?.legacyEmpresaFaturamento ?? ""
  if (legacy) {
    console.warn("[cobranca-blast] empresaId ausente; usando legacyEmpresaFaturamento:", legacy)
  } else {
    console.warn("[cobranca-blast] empresaId ausente; usando fallback Empresa Brasileira de Raios")
  }
  return {
    empresaId: null,
    nomeEmpresa: legacy || "Empresa Brasileira de Raios",
    nomeCobrador: "Sistema de Cobranças Assertivas",
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  console.log("[cobranca-blast] ruleKey:", args.ruleKey)
  console.log("[cobranca-blast] inboxId:", INBOX_ID)
  console.log("[cobranca-blast] templateName:", TEMPLATE_NAME)
  console.log("[cobranca-blast] execute:", args.execute)

  const debitos = await loadDebitos(args)
  console.log("[cobranca-blast] debitos encontrados:", debitos.length)
  if (debitos.length === 0) return

  // Agrupar por cliente (1 msg por cliente)
  const groups = new Map<string, DebitoRow[]>()
  for (const debito of debitos) {
    const clienteId = debito.clienteId
    const key = String(clienteId)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(debito)
  }

  const allGroups = Array.from(groups.entries()).map(([key, items]) => ({ key, items }))
  const offset = args.offsetClients || 0
  const afterOffset = offset > 0 ? allGroups.slice(offset) : allGroups
  const groupsToProcess = args.limitClients ? afterOffset.slice(0, args.limitClients) : afterOffset

  // Template meta
  const inboxRepository = new PrismaInboxRepository()
  const listTemplatesUseCase = new ListTemplatesUseCase(inboxRepository)
  const listResult = await listTemplatesUseCase.execute(INBOX_ID)
  const templateMeta = listResult.templates.find((t) => t.name === TEMPLATE_NAME)
  if (!templateMeta) {
    throw new Error(`Template "${TEMPLATE_NAME}" não encontrado na inbox ${INBOX_ID}.`)
  }

  console.log("[cobranca-blast] template parameter_format:", templateMeta.parameter_format ?? "POSITIONAL")
  assertTemplateCompatible(templateMeta)

  // Regra-like: template cobranca_disparo_1 (PDF no header + 4 variáveis no body)
  const ruleLike: CobrancaRuleLike = {
    parameters: {
      headerDocument: {
        linkToken: "{{cobranca.pdfLink}}",
        filenameToken: "Boletos-{{client.id}}.pdf",
      },
      // Ordem das variáveis do BODY conforme template:
      // {{nome_contato}}, {{nome_condominio}}, {{nome_empresa}}, {{nome_cobrador}}
      bodyTextTokens: ["{{nome_contato}}", "{{nome_condominio}}", "{{nome_empresa}}", "{{nome_cobrador}}"],
      headerTextTokens: [],
      buttonTextTokens: [],
    },
  }

  const templateComponents = buildTemplateComponents(ruleLike, {
    language: templateMeta.language,
    components: templateMeta.components,
    parameterFormat: templateMeta.parameter_format as any,
    namedBodyParams: getBodyNamedParamNames(templateMeta),
  })

  const contactRepository = new PrismaContactRepository()
  const contactInboxRepository = new PrismaContactInboxRepository()
  const conversationRepository = new PrismaConversationRepository()
  const messageRepository = new PrismaMessageRepository()
  const broadcaster = getBullMQBroadcaster()
  const chatEventsQueue = getChatEventsQueue()
  const sendQueue = getCobrancaReguaSendQueue()
  const clientChatContactRepository = new PrismaClientChatContactRepository()
  const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository)
  const createPendingMessageUseCase = new CreatePendingMessageUseCase(messageRepository)
  const createConversationUseCase = new CreateConversationUseCase(
    contactRepository,
    contactInboxRepository,
    conversationRepository,
    inboxRepository,
    sendMessageUseCase,
    broadcaster,
  )

  const summary = {
    groups: groupsToProcess.length,
    clients: new Set<number>(),
    debitos: 0,
    skippedAlreadyProcessed: 0,
    skippedHasConversation: 0,
    skippedNoPhone: 0,
    queued: 0,
    failed: 0,
  }

  // Não enviar para clientes que já têm conversa existente.
  // Heurística: se o cliente possui algum contactId vinculado (ClientChatContact)
  // e existe ao menos uma chat_conversation para esse contactId, consideramos "já tem conversa".
  const clientIdsToCheck = groupsToProcess
    .map((g) => g.items?.[0]?.cliente?.id)
    .filter((id): id is number => Number.isFinite(id))

  const links = await prisma.clientChatContact.findMany({
    where: { clientId: { in: Array.from(new Set(clientIdsToCheck)) } },
    select: { clientId: true, contactId: true },
  })

  const contactIds = Array.from(new Set(links.map((l) => l.contactId))).filter((id) => !!id)
  const contactsWithConversation = new Set<string>()
  if (contactIds.length > 0) {
    const conversations = await prisma.chatConversation.findMany({
      where: { contactId: { in: contactIds } },
      distinct: ["contactId"],
      select: { contactId: true },
    })
    conversations.forEach((c) => {
      if (c.contactId) contactsWithConversation.add(c.contactId)
    })
  }

  const clientsWithConversation = new Set<number>()
  links.forEach((l) => {
    if (contactsWithConversation.has(l.contactId)) {
      clientsWithConversation.add(l.clientId)
    }
  })

  for (const group of groupsToProcess) {
    const debitosGroup = group.items
    const cliente = debitosGroup[0]?.cliente
    if (!cliente) continue

    if (SKIP_CLIENT_IDS.has(cliente.id)) {
      console.warn("[cobranca-blast] skipping clientId (hardcoded):", cliente.id)
      continue
    }

    if (clientsWithConversation.has(cliente.id)) {
      console.warn("[cobranca-blast] skipping clientId (já tem conversa):", cliente.id)
      summary.skippedHasConversation += debitosGroup.length
      continue
    }

    summary.clients.add(cliente.id)
    summary.debitos += debitosGroup.length

    const representativeDebito = debitosGroup[0]
    // Dedupe por cliente+ruleKey (1 msg por cliente)
    const already = await prisma.cobrancaCampanhaEnvio.findFirst({
      where: {
        clienteId: cliente.id,
        ruleKey: args.ruleKey,
        status: { in: ["QUEUED", "SENT"] },
      },
      select: { id: true, status: true },
    })
    if (already) {
      summary.skippedAlreadyProcessed += debitosGroup.length
      continue
    }

    const phoneNumber = resolvePreferredPhone(cliente)
    if (!phoneNumber) {
      summary.skippedNoPhone += debitosGroup.length
      if (args.execute) {
        await prisma.cobrancaCampanhaEnvio.createMany({
          data: debitosGroup.map((d) => ({
            debitoId: d.id,
            clienteId: d.clienteId,
            status: "SKIPPED",
            error: "Contato não informado",
            ruleKey: args.ruleKey,
          })),
          skipDuplicates: true,
        })
      }
      continue
    }

    const company = pickCompanyProfile(debitosGroup)
    const nomeContato = (cliente as any)?.nomeSindico?.trim() || "Responsável"
    const nomeCondominio = cliente.razaoSocial ?? ""

    if (!args.execute) {
      continue
    }

    try {
      // 1) gerar PDFs individuais e merge
      const buffers: Buffer[] = []
      for (const d of debitosGroup) {
        buffers.push(await generateBoletoPdfBuffer(d))
      }
      const merged = await mergePdfBuffers(buffers)

      // 2) upload + signed url
      const uploaded = await storage.uploadPrivateObject({
        key: `cobranca/${args.ruleKey}/${cliente.id}/${Date.now()}-boletos.pdf`,
        contentType: "application/pdf",
        body: merged,
      })
      const signedPdfUrl = await storage.getDownloadUrlFromStoredUrl(uploaded.url)

      const tokens = {
        // novo
        // IMPORTANTE: mandar a URL "armazenada" e deixar o provider assinar uma vez
        // (evita confusão/dupla assinatura).
        "{{cobranca.pdfLink}}": uploaded.url,
        "{{nome_contato}}": nomeContato,
        "{{nome_condominio}}": nomeCondominio,
        "{{nome_empresa}}": company.nomeEmpresa,
        "{{nome_cobrador}}": company.nomeCobrador,
        // compat com template antigo da régua
        "{{debito.id}}": String(representativeDebito.id),
        "{{debito.valor}}": formatCurrency(representativeDebito.receber ?? 0),
        "{{debito.vencimento}}": formatDate(representativeDebito.vencimento ?? null),
        "{{debito.linkBoleto}}": signedPdfUrl ?? uploaded.url,
        "{{client.id}}": String(cliente.id),
        "{{client.razaoSocial}}": cliente.razaoSocial ?? "",
        "{{client.cnpj}}": cliente.cnpj ?? "",
      }

      const componentClone = JSON.parse(JSON.stringify(templateComponents))
      for (const component of componentClone) {
        if (component.type === "header" && Array.isArray(component.parameters)) {
          for (const param of component.parameters) {
            if (param.type === "document" && param.document) {
              // Filename safe (Meta pode rejeitar caracteres/espacos)
              param.document.filename = safePdfFilename(cliente.id)
            }
          }
        }
      }

      const templatePayload = applyTokens(
        {
          name: TEMPLATE_NAME,
          languageCode: templateMeta.language,
          components: componentClone,
        },
        tokens,
      )

      // 3) criar conversa + msg pendente
      const conversationResult = await createConversationUseCase.execute({
        inboxId: INBOX_ID,
        phoneNumber,
        contactName: cliente.razaoSocial,
        assigneeId: args.assigneeId ?? undefined,
      })

      if (conversationResult.conversation?.contactId) {
        await clientChatContactRepository.ensureLink(conversationResult.conversation.contactId, cliente.id)
      }

      const pendingMessage = await createPendingMessageUseCase.execute({
        conversationId: conversationResult.conversation.id,
        assigneeId: args.assigneeId ?? undefined,
        contentType: "template",
        messageType: "template",
        contentAttributes: { template: templatePayload },
      })
      const messageId = pendingMessage?.id
      if (!messageId) throw new Error("Falha ao criar mensagem pendente")

      await chatEventsQueue.add(
        "message.created",
        { type: "message.created", payload: pendingMessage },
        { jobId: `msg-event-${messageId}` },
      )

      // 4) gravar rastreio: 1 envio QUEUED + resto SKIPPED (consolidado)
      await prisma.cobrancaCampanhaEnvio.createMany({
        data: debitosGroup.map((d) => ({
          debitoId: d.id,
          clienteId: d.clienteId,
          status: d.id === representativeDebito.id ? "QUEUED" : "SKIPPED",
          error: d.id === representativeDebito.id ? null : `Consolidado no envio do débito ${representativeDebito.id}`,
          messageId: d.id === representativeDebito.id ? messageId : null,
          ruleKey: args.ruleKey,
        })),
        skipDuplicates: true,
      })

      const envioRecord = await prisma.cobrancaCampanhaEnvio.findUnique({
        where: {
          debitoId_ruleKey: {
            debitoId: representativeDebito.id,
            ruleKey: args.ruleKey,
          },
        },
        select: { id: true },
      })

      if (!envioRecord?.id) throw new Error("Envio record não encontrado após createMany")

      await sendQueue.add(
        `cobranca-regua-send-${envioRecord.id}`,
        { envioId: envioRecord.id, messageId },
        { removeOnComplete: true, removeOnFail: false },
      )

      summary.queued += 1
    } catch (error) {
      summary.failed += 1
      const message = error instanceof Error ? error.message : "Erro ao preparar envio"
      console.error("[cobranca-blast] failed group", group.key, message)
    }
  }

  console.log("[cobranca-blast] SUMMARY", {
    ...summary,
    uniqueClients: summary.clients.size,
  })

  if (!args.execute) {
    console.log(
      '[cobranca-blast] DRY-RUN: nada foi enfileirado/enviado. Use "--execute" para executar.',
    )
  }
}

main().catch((err) => {
  console.error("[cobranca-blast] fatal", err)
  process.exit(1)
})

