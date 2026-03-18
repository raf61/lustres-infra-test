
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session || !session.user?.role || session.user.role !== "MASTER") {
            // "A precisa passar pela aprovação do master de alguma forma"
            // Vou assumir que só MASTER pode aprovar/cancelar no dashboard
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const body = await request.json()
        const { action, id } = body // id = unusedCnpjs.id

        if (!id || !action) {
            return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
        }

        const { confirmUnusedCnpjBlock, cancelUnusedCnpjBlock } = await import("@/domain/client/unused-cnpj-actions")

        try {
            if (action === "CANCEL_BLOCK") {
                await cancelUnusedCnpjBlock(Number(id))
                return NextResponse.json({ success: true, message: "Bloqueio cancelado" })
            }

            if (action === "CONFIRM_BLOCK") {
                await confirmUnusedCnpjBlock(Number(id))
                return NextResponse.json({ success: true, message: "Bloqueio confirmado e cliente removido." })
            }

            return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
        } catch (err) {
            return NextResponse.json({
                error: err instanceof Error ? err.message : "Erro desconhecido"
            }, { status: 400 })
        }

        return NextResponse.json({ error: "Ação inválida" }, { status: 400 })

    } catch (error) {
        console.error("Erro na ação de unused client:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
