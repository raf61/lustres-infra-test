
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatCnpjForDatabase } from "@/lib/cnpj"
import { auth } from "@/auth"

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Listar apenas os não confirmados (sugeridos)
        const unusedList = await prisma.unusedCnpjs.findMany({
            where: {
                confirmed: false,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        })

        return NextResponse.json({ data: unusedList })
    } catch (error) {
        console.error("Erro ao listar unused clients:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { cnpj } = body

        if (!cnpj) {
            return NextResponse.json({ error: "CNPJ é obrigatório" }, { status: 400 })
        }

        const { requestUnusedCnpjBlock } = await import("@/domain/client/unused-cnpj-actions")

        try {
            const created = await requestUnusedCnpjBlock(cnpj, session.user.id)
            return NextResponse.json({ data: created }, { status: 201 })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Erro desconhecido"
            const status = message.includes("já está na lista") ? 409 : 400
            return NextResponse.json({ error: message }, { status })
        }


    } catch (error) {
        console.error("Erro ao criar unused client request:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
