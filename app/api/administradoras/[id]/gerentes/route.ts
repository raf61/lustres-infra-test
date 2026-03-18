import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Lista gerentes de uma administradora
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const administradoraId = parseInt(id, 10)

    if (isNaN(administradoraId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const gerentes = await (prisma as any).gerenteAdministradora.findMany({
      where: { administradoraId },
      select: {
        id: true,
        nome: true,
        email: true,
        celular: true,
        whatsapp: true,
      },
      orderBy: { nome: "asc" },
    })

    return NextResponse.json({ data: gerentes })
  } catch (error) {
    console.error("Erro ao buscar gerentes:", error)
    return NextResponse.json(
      { error: "Erro ao buscar gerentes" },
      { status: 500 }
    )
  }
}

// POST - Cria um novo gerente para a administradora
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const administradoraId = parseInt(id, 10)
    
    if (isNaN(administradoraId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const body = await request.json()

    const { nome, email, celular, whatsapp, cpf } = body

    if (!nome) {
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      )
    }

    const gerente = await (prisma as any).gerenteAdministradora.create({
      data: {
        nome,
        email: email || null,
        celular: celular || null,
        whatsapp: whatsapp || null,
        cpf: cpf || null,
        administradoraId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        celular: true,
        whatsapp: true,
      },
    })

    return NextResponse.json({ data: gerente })
  } catch (error) {
    console.error("Erro ao criar gerente:", error)
    return NextResponse.json(
      { error: "Erro ao criar gerente" },
      { status: 500 }
    )
  }
}

