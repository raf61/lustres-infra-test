import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"]

type RouteContext = {
    params: Promise<{ pedidoId: string }>
}

export async function GET(_: Request, context: RouteContext) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 })
    }

    try {
        const { pedidoId } = await context.params
        const id = Number(pedidoId)

        if (isNaN(id)) {
            return NextResponse.json({ error: "pedidoId inválido" }, { status: 400 })
        }

        const nfes = await prisma.nfe.findMany({
            where: { pedidoId: id },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({ data: nfes })
    } catch (e: any) {
        console.error("[NFE by Pedido] Erro:", e)
        return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 })
    }
}
