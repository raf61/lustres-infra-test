import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureDebitos } from "@/domain/financeiro/ensure-debitos.usecase"

const ALLOWED_ROLES = new Set(["MASTER", "ADMINISTRADOR", "FINANCEIRO"])

export async function POST(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const role = (session.user as { role?: string }).role
        if (!role || !ALLOWED_ROLES.has(role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { id } = await props.params
        const pedidoId = Number(id)
        if (isNaN(pedidoId)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        // Chama o UseCase
        const result = await ensureDebitos(prisma, pedidoId)

        return NextResponse.json(result)
    } catch (err) {
        console.error("[ensure-debitos]", err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Erro desconhecido" },
            { status: 400 }
        )
    }
}
