import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { IssueNfeUseCase } from "@/nfe/domain/use-cases/issue-nfe.usecase"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"]

export async function POST(request: Request) {
    const session = await auth()
    if (!session?.user) {
        console.error("[API Issue] Falha de autenticação: Usuário não logado no sistema.")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verificação de Autorização por Role
    const userRole = (session.user as any).role
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        console.warn(`[API Issue] Acesso negado para role: ${userRole}`)
        return NextResponse.json({ error: "Acesso não autorizado. Apenas MASTER, ADMINISTRADOR ou FINANCEIRO podem emitir notas." }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { pedidoId, extras, overridePayload } = body

        console.log(`[API Issue] Iniciando emissão para Pedido ${pedidoId} (User: ${session.user.email})`)

        if (!pedidoId) return NextResponse.json({ error: "pedidoId required" }, { status: 400 })

        const useCase = new IssueNfeUseCase()
        const result = await useCase.execute({
            pedidoId: Number(pedidoId),
            extras,
            overridePayload
        })

        console.log("[API Issue] Sucesso:", result.id)
        return NextResponse.json(result)
    } catch (e: any) {
        console.error("[API Issue] Erro capturado:", e)
        const detailedError = e.response?.data ?
            `Erro Nfe.io: ${JSON.stringify(e.response.data)}` :
            e.message

        console.error("[API Issue] Detalhe:", detailedError)
        return NextResponse.json({ error: detailedError || "Internal Server Error" }, { status: 500 })
    }
}
