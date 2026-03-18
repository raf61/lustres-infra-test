import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoggedUserId } from "@/lib/vendor-dashboard"

type RouteParams = { params: Promise<{ id: string }> }

// GET - Fetch all registros for a client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const clientId = parseInt(id, 10)
    
    if (isNaN(clientId)) {
      return NextResponse.json({ error: "ID de cliente inválido" }, { status: 400 })
    }

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
    console.error("Error fetching client registros:", error)
    return NextResponse.json({ error: "Erro ao buscar registros" }, { status: 500 })
  }
}

// POST - Create a new registro for a client
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const clientId = parseInt(id, 10)
    
    if (isNaN(clientId)) {
      return NextResponse.json({ error: "ID de cliente inválido" }, { status: 400 })
    }

    const body = await request.json()
    const { mensagem } = body

    if (!mensagem || typeof mensagem !== "string" || mensagem.trim().length === 0) {
      return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 })
    }

    // Obtém o ID do usuário logado
    const userId = await getLoggedUserId()
    
    if (!userId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    // Verify that the client exists
    const clientExists = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    })

    if (!clientExists) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
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
    console.error("Error creating client registro:", error)
    return NextResponse.json({ error: "Erro ao criar registro" }, { status: 500 })
  }
}
