import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"
import PDFMerger from "pdf-merger-js"
import { generateLaudoTecnicoPdfBuffer } from "@/lib/documents/laudo-tecnico"
import { generateTermoConclusaoPdfBuffer } from "@/lib/documents/termo-conclusao"
import { generateOrdemServicoPdfBuffer } from "@/lib/documents/ordem-servico"
import { generateCartaEndossoPdfBuffer } from "@/lib/documents/carta-endosso"
import { generateRelatorioVistoriaPdfBuffer } from "@/lib/documents/relatorio-vistoria"
import { generateReciboPdfBuffer } from "@/lib/documents/recibo"
import { DocumentoOperacionalTipo } from "@prisma/client"
import { SendMessageUseCase } from "@/chat/application/send-message.usecase"
import { CreateConversationIfNotExistsUseCase } from "@/chat/application/create-conversation-if-not-exists.usecase"
import { PrismaContactInboxRepository } from "@/chat/infra/repositories/prisma-contact-inbox-repository"
import { CreateConversationUseCase } from "@/chat/application/create-conversation.usecase"
import { PrismaMessageRepository } from "@/chat/infra/repositories/prisma-message-repository"
import { PrismaConversationRepository } from "@/chat/infra/repositories/prisma-conversation-repository"
import { PrismaContactRepository } from "@/chat/infra/repositories/prisma-contact-repository"
import { PrismaInboxRepository } from "@/chat/infra/repositories/prisma-inbox-repository"
import { PrismaClientRepository } from "@/chat/infra/repositories/prisma-client-repository"
import { AssociateClientToConversationUseCase } from "@/chat/application/associate-client-to-conversation.usecase"
import { BullMQBroadcaster } from "@/chat/infra/events/bullmq-broadcaster"
import { generateMergedBoletosPdf } from "@/domain/pedido/boletos/generate-merged-boletos-usecase"
import { generateItauBoletoPdf, generateSantanderBoletoPdf } from "@/lib/boleto"
import fs from "fs"
import { DownloadNfeUseCase } from "@/nfe/domain/use-cases/download-nfe.usecase"
import { PrismaClientChatContactRepository } from "@/chat/infra/repositories/prisma-client-chat-contact-repository"

export type SelectedDocument = {
    type: "laudo" | "termo" | "vistoria" | "endosso" | "os" | "recibo" | "boletos" | "nfe_pdf" | "documento_operacional"
    id?: string | number // ID do DocumentoOperacional ou NFe
}

export type SendOrderDocumentsInput = {
    pedidoId: number
    selectedDocuments: SelectedDocument[]
    phoneNumbers: string[]
    nomeEmpresa: string
    inboxId?: string
}

export class SendOrderDocumentsToClientUseCase {
    constructor(
        private sendMessageUseCase: SendMessageUseCase,
        private createConversationUseCase: CreateConversationIfNotExistsUseCase,
        private associateClientUseCase: AssociateClientToConversationUseCase,
    ) { }

    async execute(input: SendOrderDocumentsInput): Promise<{ messageIds: string[] }> {
        const { pedidoId, selectedDocuments, phoneNumbers, nomeEmpresa, inboxId: inputInboxId } = input

        // 1. Fetch data
        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            include: {
                cliente: true,
                documentosOperacionais: true,
            },
        })

        if (!pedido) throw new Error("Pedido não encontrado")

        // 2. Generate/Collect PDFs
        const pdfBuffers: Buffer[] = []
        const typesSeen = new Set<string>()

        for (const doc of selectedDocuments) {
            if (typesSeen.has(doc.type) && doc.type !== 'documento_operacional') continue
            typesSeen.add(doc.type)

            let buffer: Buffer | null = null

            switch (doc.type) {
                case "laudo": {
                    const res = await generateLaudoTecnicoPdfBuffer({ pedidoId })
                    buffer = res?.buffer ?? null
                    break
                }
                case "termo": {
                    const opDoc = pedido.documentosOperacionais.find(d => d.tipo === DocumentoOperacionalTipo.TERMO_CONCLUSAO)
                    if (opDoc) {
                        if (opDoc.url) {
                            const key = storage.parseKeyFromUrl(opDoc.url)
                            if (key) {
                                const data = await storage.getPrivateObject(key)
                                if (data) buffer = data as Buffer
                            }
                        }
                        if (!buffer) {
                            const res = await generateTermoConclusaoPdfBuffer({ documentoId: opDoc.id })
                            buffer = res?.buffer ?? null
                        }
                    }
                    break
                }
                case "os": {
                    const opDoc = pedido.documentosOperacionais.find(d => d.tipo === DocumentoOperacionalTipo.ORDEM_SERVICO)
                    if (opDoc) {
                        if (opDoc.url) {
                            const key = storage.parseKeyFromUrl(opDoc.url)
                            if (key) {
                                const data = await storage.getPrivateObject(key)
                                if (data) buffer = data as Buffer
                            }
                        }
                        if (!buffer) {
                            const res = await generateOrdemServicoPdfBuffer({ documentoId: opDoc.id })
                            buffer = res?.buffer ?? null
                        }
                    }
                    break
                }
                case "endosso": {
                    const res = await generateCartaEndossoPdfBuffer({ pedidoId })
                    buffer = res?.buffer ?? null
                    break
                }
                case "recibo": {
                    const res = await generateReciboPdfBuffer(pedidoId)
                    buffer = res?.buffer ?? null
                    break
                }
                case "vistoria": {
                    const opDoc = pedido.documentosOperacionais.find(d => d.tipo === DocumentoOperacionalTipo.RELATORIO_VISTORIA)
                    if (opDoc?.url) {
                        const key = storage.parseKeyFromUrl(opDoc.url)
                        if (key) {
                            const data = await storage.getPrivateObject(key)
                            if (data) buffer = data as Buffer
                        }
                    }
                    break
                }
                case "documento_operacional": {
                    if (doc.id) {
                        const opId = typeof doc.id === 'string' ? parseInt(doc.id) : doc.id
                        const op = pedido.documentosOperacionais.find(d => d.id === opId)
                        if (op?.url) {
                            const key = storage.parseKeyFromUrl(op.url)
                            if (key) {
                                const data = await storage.getPrivateObject(key)
                                if (data) buffer = data as Buffer
                            }
                        }
                    }
                    break
                }
                case "boletos": {
                    try {
                        const bancosSuportados = new Set([341, 33])
                        const boletoRes = await generateMergedBoletosPdf(
                            prisma as any,
                            { pedidoId },
                            {
                                generateBoletoPdf: async (debito) => {
                                    if (!debito.banco || !bancosSuportados.has(debito.banco.bancoCodigo)) {
                                        throw new Error("Banco não suportado")
                                    }
                                    const sacado = {
                                        nome: debito.cliente?.razaoSocial ?? "",
                                        cnpj: debito.cliente?.cnpj ?? undefined,
                                        logradouro: [debito.cliente?.logradouro, debito.cliente?.numero, debito.cliente?.complemento].filter(Boolean).join(" "),
                                        bairro: debito.cliente?.bairro ?? "",
                                        cidade: debito.cliente?.cidade ?? "",
                                        uf: debito.cliente?.estado ?? "",
                                        cep: debito.cliente?.cep ?? "",
                                    }
                                    const cedente = {
                                        razaoSocial: debito.banco.razaoSocial,
                                        cnpj: debito.banco.cnpj,
                                        agencia: debito.banco.agencia || "",
                                        agenciaDigito: debito.banco.agenciaDigito || "",
                                        conta: debito.banco.conta || "",
                                        contaDigito: debito.banco.contaDigito || "",
                                        carteira: debito.banco.carteira,
                                        codigoBeneficiario: debito.banco.codigoBeneficiario,
                                    }
                                    const titulo = {
                                        nossoNumero: debito.id,
                                        numeroDocumento: debito.id.toString(),
                                        valor: Number(debito.receber ?? 0),
                                        vencimento: debito.vencimento!,
                                    }

                                    const genFn = debito.banco.bancoCodigo === 341 ? generateItauBoletoPdf : generateSantanderBoletoPdf
                                    const { filePath } = await genFn({ cedente, sacado, titulo, destinoDir: "/tmp" })
                                    const b = fs.readFileSync(filePath)
                                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
                                    return b
                                },
                                mergePdfBuffers: async (bufs) => {
                                    const m = new PDFMerger()
                                    for (const bf of bufs) await m.add(bf)
                                    return await m.saveAsBuffer() as Buffer
                                }
                            }
                        )
                        buffer = boletoRes.buffer
                    } catch (err) {
                        console.error("[SendDocs] Error generating boletos:", err)
                    }
                    break
                }
                case "nfe_pdf": {
                    if (doc.id) {
                        try {
                            const nfeUseCase = new DownloadNfeUseCase()
                            const nfeRes = await nfeUseCase.execute(String(doc.id))
                            if (nfeRes.type === 'content') {
                                buffer = nfeRes.data as Buffer
                            } else {
                                // Se for URL, baixa o conteúdo
                                const response = await fetch(nfeRes.data as string)
                                if (response.ok) {
                                    buffer = await response.arrayBuffer() as any
                                }
                            }
                        } catch (err) {
                            console.error(`[SendDocs] Error downloading NFe ${doc.id}:`, err)
                        }
                    }
                    break
                }
            }

            if (buffer) {
                pdfBuffers.push(buffer)
            }
        }

        if (pdfBuffers.length === 0) {
            throw new Error("Nenhum documento selecionado pôde ser gerado/encontrado.")
        }

        // 3. Merge PDFs
        const merger = new PDFMerger()
        for (const b of pdfBuffers) {
            await merger.add(b)
        }
        const mergedBuffer = await merger.saveAsBuffer() as Buffer

        // 4. Upload merged PDF
        const timestamp = Date.now()
        const mergedKey = `documentos/pedidos/${pedidoId}/documentos-cliente-${timestamp}.pdf`
        const uploadResult = await storage.uploadPrivateObject({
            key: mergedKey,
            contentType: "application/pdf",
            body: mergedBuffer,
        })

        // 5. Send to each phone number
        const messageIds: string[] = []
        const inboxId = inputInboxId || await this.getWhatsAppInboxId()

        for (const phone of phoneNumbers) {
            const digits = phone.replace(/\D/g, "")
            if (!digits) continue

            // Normalize: Ensure 55 prefix (Brazilian country code)
            const cleanPhone = digits.startsWith("55") ? digits : `55${digits}`

            // Ensure conversation exists + Reuse current logic (which internally handles 55/9 alternatives)
            const conversationResult = await this.createConversationUseCase.execute({
                inboxId,
                phoneNumber: cleanPhone,
                contactName: pedido.cliente.razaoSocial,
            })

            const conversationId = conversationResult.conversationId
            if (!conversationId) continue

            // Ensure client link (linking chat contact to the client in the order)
            // This guarantees that if we reuse/create a conversation, it's pinned to the correct client.
            await this.associateClientUseCase.execute({
                conversationId,
                clientId: pedido.clienteId,
            }).catch(err => {
                console.error(`[SendOrderDocuments] Error linking client ${pedido.clienteId} to conversation ${conversationId}:`, err)
            })

            const res = await this.sendMessageUseCase.execute({
                conversationId,
                messageType: "template",
                contentAttributes: {
                    template: {
                        name: "documentos_conclusao_pedido",
                        languageCode: "pt_BR",
                        components: [
                            {
                                type: "header",
                                parameters: [
                                    {
                                        type: "document",
                                        document: {
                                            link: uploadResult.url,
                                            filename: `Documentos_Pedido_${pedidoId}.pdf`
                                        }
                                    }
                                ]
                            },
                            {
                                type: "body",
                                parameters: [
                                    {
                                        type: "text",
                                        parameter_name: "nome_empresa",
                                        text: nomeEmpresa
                                    },
                                    {
                                        type: "text",
                                        parameter_name: "razao_social",
                                        text: pedido.cliente.razaoSocial
                                    },
                                    {
                                        type: "text",
                                        parameter_name: "num_pedido",
                                        text: pedidoId.toString()
                                    }
                                ]
                            }
                        ]
                    }
                }
            })

            messageIds.push(res.message.id)
        }

        return { messageIds }
    }

    private async getWhatsAppInboxId(): Promise<string> {
        const inbox = await prisma.chatInbox.findFirst({
            where: { provider: "whatsapp_cloud" }
        })
        if (!inbox) throw new Error("Inbox de WhatsApp não configurada.")
        return inbox.id
    }
}

export function createSendOrderDocumentsUseCase() {
    const broadcaster = new BullMQBroadcaster()
    const messageRepo = new PrismaMessageRepository()
    const conversationRepo = new PrismaConversationRepository()
    const contactRepo = new PrismaContactRepository()
    const inboxRepo = new PrismaInboxRepository()
    const clientRepo = new PrismaClientRepository()
    const contactInboxRepo = new PrismaContactInboxRepository()
    const clientChatContactRepo = new PrismaClientChatContactRepository()

    const sendMessageUseCase = new SendMessageUseCase(
        messageRepo,
        conversationRepo
    )

    const createConversationStepUseCase = new CreateConversationUseCase(
        contactRepo,
        contactInboxRepo,
        conversationRepo,
        inboxRepo,
        sendMessageUseCase,
        broadcaster
    )

    const createConversationUseCase = new CreateConversationIfNotExistsUseCase(
        contactRepo,
        contactInboxRepo,
        conversationRepo,
        inboxRepo,
        createConversationStepUseCase
    )

    const associateClientUseCase = new AssociateClientToConversationUseCase(
        conversationRepo,
        clientRepo,
        clientChatContactRepo
    )

    return new SendOrderDocumentsToClientUseCase(
        sendMessageUseCase,
        createConversationUseCase,
        associateClientUseCase
    )
}


