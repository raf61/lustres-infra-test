
import { NextResponse } from "next/server"
import { createSendOrderDocumentsUseCase } from "@/domain/pedido/documentos/usecases/send-order-documents-to-client.usecase"
import { auth } from "@/auth"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
        }

        const { id } = await context.params
        const pedidoId = Number.parseInt(id, 10)
        if (Number.isNaN(pedidoId)) {
            return NextResponse.json({ error: "ID do pedido inválido" }, { status: 400 })
        }

        const body = await request.json()
        const { selectedDocuments, phoneNumbers, nomeEmpresa, inboxId } = body

        if (!selectedDocuments || !Array.isArray(selectedDocuments) || selectedDocuments.length === 0) {
            return NextResponse.json({ error: "Nenhum documento selecionado" }, { status: 400 })
        }

        if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
            return NextResponse.json({ error: "Nenhum telefone selecionado" }, { status: 400 })
        }

        const useCase = createSendOrderDocumentsUseCase()
        const result = await useCase.execute({
            pedidoId,
            selectedDocuments,
            phoneNumbers,
            nomeEmpresa: nomeEmpresa || "Empresa Brasileira de Raios",
            inboxId
        })

        return NextResponse.json({ success: true, messageIds: result.messageIds })
    } catch (error) {
        console.error("[pedidos][documentos][enviar][POST]", error)
        const message = error instanceof Error ? error.message : "Erro ao enviar documentos"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
