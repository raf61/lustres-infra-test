import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoggedUserId } from "@/lib/vendor-dashboard"

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const cnpj = searchParams.get("cnpj")

        if (!cnpj) {
            return NextResponse.json({ error: "CNPJ não informado" }, { status: 400 })
        }

        // Encontra o Cliente pelo CNPJ (unmasked)
        const client = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Client"
      WHERE regexp_replace(cnpj, '\\\\D', '', 'g') = regexp_replace(${cnpj}, '\\\\D', '', 'g')
      LIMIT 1
    `

        if (!client || client.length === 0) {
            return NextResponse.json({ success: true, data: [] })
        }

        const clientId = client[0].id

        const registros = await prisma.clientRegistro.findMany({
            where: { clientId },
            orderBy: { createdAt: "asc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        fullname: true,
                    },
                },
            },
        })

        return NextResponse.json({
            success: true,
            data: registros.map((r) => ({
                id: r.id,
                clientId: r.clientId,
                mensagem: r.mensagem,
                userId: r.userId,
                userName: r.user.fullname || r.user.name,
                createdAt: r.createdAt.toISOString(),
                updatedAt: r.updatedAt.toISOString(),
            })),
        })
    } catch (error) {
        console.error("Error fetching client registros by cnpj:", error)
        return NextResponse.json({ error: "Erro ao buscar registros" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { cnpj, mensagem } = body

        if (!cnpj) {
            return NextResponse.json({ error: "CNPJ não informado" }, { status: 400 })
        }

        if (!mensagem || typeof mensagem !== "string" || mensagem.trim().length === 0) {
            return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 })
        }

        // Encontra o Cliente pelo CNPJ (unmasked)
        const client = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Client"
      WHERE regexp_replace(cnpj, '\\\\D', '', 'g') = regexp_replace(${cnpj}, '\\\\D', '', 'g')
      LIMIT 1
    `

        if (!client || client.length === 0) {
            return NextResponse.json({ error: "Cliente não encontrado para este CNPJ" }, { status: 404 })
        }

        const clientId = client[0].id

        // Obtém o ID do usuário logado
        const userId = await getLoggedUserId()

        if (!userId) {
            return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
        }

        // Verify that the user exists
        const userExists = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, fullname: true },
        })

        if (!userExists) {
            return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
        }

        const registro = await prisma.clientRegistro.create({
            data: {
                clientId,
                mensagem: mensagem.trim(),
                userId,
            },
        })

        return NextResponse.json({
            success: true,
            data: {
                id: registro.id,
                clientId: registro.clientId,
                mensagem: registro.mensagem,
                userId: registro.userId,
                userName: userExists.fullname || userExists.name,
                createdAt: registro.createdAt.toISOString(),
                updatedAt: registro.updatedAt.toISOString(),
            },
        }, { status: 201 })
    } catch (error) {
        console.error("Error creating client registro by cnpj:", error)
        return NextResponse.json({ error: "Erro ao criar registro" }, { status: 500 })
    }
}
