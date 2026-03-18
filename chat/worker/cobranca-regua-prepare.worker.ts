import { ensureCobrancaReguaPrepareWorker } from "../infra/queue/cobranca-regua-prepare.queue"
import { getCobrancaReguaSendQueue } from "../infra/queue/cobranca-regua-send.queue"
import fs from "fs"
import { prisma } from "../../lib/prisma"
import { storage } from "../../lib/storage"
import { PrismaContactRepository } from "../infra/repositories/prisma-contact-repository"
import { PrismaContactInboxRepository } from "../infra/repositories/prisma-contact-inbox-repository"
import { PrismaConversationRepository } from "../infra/repositories/prisma-conversation-repository"
import { PrismaInboxRepository } from "../infra/repositories/prisma-inbox-repository"
import { PrismaMessageRepository } from "../infra/repositories/prisma-message-repository"
import { getBullMQBroadcaster } from "../infra/events/bullmq-broadcaster"
import { getChatEventsQueue } from "../infra/queue/chat-events.queue"
import { CreateConversationUseCase } from "../application/create-conversation.usecase"
import { CreatePendingMessageUseCase } from "../application/create-pending-message.usecase"
import { SendMessageUseCase } from "../application/send-message.usecase"
import { generateItauBoletoPdf, generateSantanderBoletoPdf } from "./_worker-boleto-generator"

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

const chunkArray = <T,>(items: T[], chunkSize: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
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

const getEmpresaDisplayInfo = (empresaId: number | null | undefined) => {
  if (empresaId === 2) {
    return {
      nomeEmpresa: "Franklin Instalações",
      nomeCobrador: "Franklin Instalações de Pararaios",
    }
  }

  return {
    nomeEmpresa: "Empresa Brasileira de Raios",
    nomeCobrador: "Sistema de Cobranças Assertivas",
  }
}

ensureCobrancaReguaPrepareWorker(async (jobData) => {
  const contactRepository = new PrismaContactRepository()
  const contactInboxRepository = new PrismaContactInboxRepository()
  const conversationRepository = new PrismaConversationRepository()
  const inboxRepository = new PrismaInboxRepository()
  const messageRepository = new PrismaMessageRepository()
  const broadcaster = getBullMQBroadcaster()
  const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository)
  const createPendingMessageUseCase = new CreatePendingMessageUseCase(messageRepository)
  const sendQueue = getCobrancaReguaSendQueue()
  const chatEventsQueue = getChatEventsQueue()
  const createConversationUseCase = new CreateConversationUseCase(
    contactRepository,
    contactInboxRepository,
    conversationRepository,
    inboxRepository,
    sendMessageUseCase,
    broadcaster,
  )

  const debitoChunks = chunkArray(jobData.debitoIds, 500)

  const upsertEnvio = async (data: {
    debitoId: number
    clienteId: number
    status: string
    error?: string | null
    messageId?: string | null
  }) => {
    await prisma.cobrancaCampanhaEnvio.upsert({
      where: {
        debitoId_ruleKey: {
          debitoId: data.debitoId,
          ruleKey: jobData.ruleKey,
        },
      },
      create: {
        debitoId: data.debitoId,
        clienteId: data.clienteId,
        status: data.status,
        error: data.error ?? null,
        messageId: data.messageId ?? null,
        ruleKey: jobData.ruleKey,
      },
      update: {
        status: data.status,
        error: data.error ?? null,
        messageId: data.messageId ?? null,
      },
    })
  }

  for (const debitoChunk of debitoChunks) {
    const debitos = await prisma.debito.findMany({
      where: { id: { in: debitoChunk } },
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
            orcamento: {
              select: {
                empresaId: true,
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
    })

    for (const debito of debitos) {
      const cliente = debito.cliente
      const phoneNumber = cliente ? resolvePreferredPhone(cliente) : null

      if (!phoneNumber || !cliente) {
        await upsertEnvio({
          debitoId: debito.id,
          clienteId: debito.clienteId,
          status: "SKIPPED",
          error: "Contato não informado",
        })
        continue
      }

      let boletoUrl = debito.linkBoleto ?? ""
      if (!boletoUrl) {
        const banco = debito.pedido?.bancoEmissor
        if (!banco || !debito.pedido?.bancoEmissorId) {
          await upsertEnvio({
            debitoId: debito.id,
            clienteId: debito.clienteId,
            status: "FAILED",
            error: "Banco emissor não associado ao débito.",
          })
          continue
        }
        if (![341, 33].includes(banco.bancoCodigo)) {
          await upsertEnvio({
            debitoId: debito.id,
            clienteId: debito.clienteId,
            status: "FAILED",
            error: "Banco não suportado para geração de boleto.",
          })
          continue
        }
        const sacado = {
          nome: cliente.razaoSocial ?? "",
          cnpj: cliente.cnpj ?? undefined,
          logradouro:
            [cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(" ") || "",
          bairro: cliente.bairro ?? "",
          cidade: cliente.cidade ?? "",
          uf: cliente.estado ?? "",
          cep: cliente.cep ?? "",
        }
        const enderecoBanco =
          banco.endereco && typeof banco.endereco === "object" && !Array.isArray(banco.endereco)
            ? (banco.endereco as any)
            : {}
        const contaBase = banco.conta
        const codigoBeneficiario = banco.codigoBeneficiario
        const cedente = {
          razaoSocial: banco.razaoSocial,
          cnpj: banco.cnpj,
          agencia: banco.agencia || "",
          agenciaDigito: banco.agenciaDigito || "",
          conta: contaBase || "",
          contaDigito: banco.contaDigito || "",
          carteira: banco.carteira,
          codigoBeneficiario,
          endereco: enderecoBanco,
        }
        const valorTitulo = Number(debito.receber ?? 0)
        if (!valorTitulo || Number.isNaN(valorTitulo) || valorTitulo <= 0 || !debito.vencimento) {
          await upsertEnvio({
            debitoId: debito.id,
            clienteId: debito.clienteId,
            status: "FAILED",
            error: "Valor ou vencimento inválido para emissão de boleto.",
          })
          continue
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
        const pdfBuffer = fs.readFileSync(filePath)
        const uploaded = await storage.uploadPrivateObject({
          key: `boletos/${debito.id}/${Date.now()}-boleto.pdf`,
          contentType: "application/pdf",
          body: pdfBuffer,
        })
        boletoUrl = uploaded.url
        await prisma.debito.update({
          where: { id: debito.id },
          data: { linkBoleto: boletoUrl },
        })
      }

      const empresaInfo = getEmpresaDisplayInfo(debito.pedido?.orcamento?.empresaId)

      const tokens = {
        "{{debito.id}}": String(debito.id),
        "{{debito.valor}}": formatCurrency(debito.receber ?? 0),
        "{{debito.vencimento}}": formatDate(debito.vencimento ?? null),
        // IMPORTANTE: manter como "stored url" (sem assinatura). O provider assina na hora de enviar.
        "{{debito.linkBoleto}}": boletoUrl ?? "",
        "{{client.id}}": String(cliente.id),
        "{{client.razaoSocial}}": cliente.razaoSocial ?? "",
        "{{client.cnpj}}": cliente.cnpj ?? "",
        "{{nome_contato}}": cliente.nomeSindico ?? cliente.razaoSocial ?? "",
        "{{razao_social}}": cliente.razaoSocial ?? "",
        "{{nome_empresa}}": empresaInfo.nomeEmpresa,
        "{{nome_cobrador}}": empresaInfo.nomeCobrador,
      }

      const templateComponents = JSON.parse(JSON.stringify(jobData.template.components ?? []))

      for (const component of templateComponents) {
        if (component.type === "header" && Array.isArray(component.parameters)) {
          for (const param of component.parameters) {
            if (param.type === "document" && param.document) {
              if (!param.document.filename) {
                param.document.filename = `Boleto-${debito.id}.pdf`
              }
            }
          }
        }
      }

      const templatePayload = applyTokens(
        {
          name: jobData.template.name,
          languageCode: jobData.template.languageCode,
          components: templateComponents,
        },
        tokens,
      )

      try {
        const conversationResult = await createConversationUseCase.execute({
          inboxId: jobData.inboxId,
          phoneNumber,
          contactName: cliente.razaoSocial,
          assigneeId: jobData.assigneeId ?? undefined,
        })

        if (conversationResult.conversation?.contactId) {
          await prisma.clientChatContact.upsert({
            where: {
              clientId_contactId: { clientId: cliente.id, contactId: conversationResult.conversation.contactId },
            },
            create: { clientId: cliente.id, contactId: conversationResult.conversation.contactId },
            update: {},
          })
        }

        const pendingMessage = await createPendingMessageUseCase.execute({
          conversationId: conversationResult.conversation.id,
          assigneeId: jobData.assigneeId ?? undefined,
          contentType: "template",
          messageType: "template",
          contentAttributes: {
            template: templatePayload,
          },
        })
        const messageId = pendingMessage?.id
        if (!messageId) {
          throw new Error("Falha ao criar mensagem pendente")
        }

        await chatEventsQueue.add(
          "message.created",
          { type: "message.created", payload: pendingMessage },
          { jobId: `msg-event-${messageId}` },
        )

        await upsertEnvio({
          debitoId: debito.id,
          clienteId: debito.clienteId,
          messageId,
          status: "QUEUED",
        })

        const envioRecord = await prisma.cobrancaCampanhaEnvio.findUnique({
          where: {
            debitoId_ruleKey: {
              debitoId: debito.id,
              ruleKey: jobData.ruleKey,
            },
          },
          select: { id: true },
        })

        if (envioRecord?.id) {
          await sendQueue.add(
            `cobranca-regua-send-${envioRecord.id}`,
            { envioId: envioRecord.id, messageId },
            { removeOnComplete: true, removeOnFail: false },
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao enviar mensagem"
        await upsertEnvio({
          debitoId: debito.id,
          clienteId: debito.clienteId,
          status: "FAILED",
          error: message,
        })
      }
    }
  }
})

console.log("[cobranca-regua-prepare.worker] Worker initialized")

