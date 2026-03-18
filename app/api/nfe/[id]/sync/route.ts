
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { SyncNfeUseCase } from "@/nfe/domain/use-cases/sync-nfe.usecase"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "SAC"]

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userRole = (session.user as any).role
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 })
    }

    const { id } = await context.params

    try {
        const useCase = new SyncNfeUseCase()
        const result = await useCase.execute(id)

        return NextResponse.json({ success: true, data: result })
    } catch (e: any) {
        console.error("[Sync API] Error:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
