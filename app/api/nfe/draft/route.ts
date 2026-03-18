import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { PrepareNfeDraftUseCase } from "@/nfe/domain/use-cases/prepare-nfe-draft.usecase"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"]

export async function GET(request: Request) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userRole = (session.user as any).role
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pedidoId = searchParams.get('pedidoId')

    if (!pedidoId) return NextResponse.json({ error: "pedidoId required" }, { status: 400 })

    try {
        const useCase = new PrepareNfeDraftUseCase()
        const result = await useCase.execute(Number(pedidoId))
        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
