import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Lista gerentes vinculados a um client ou ficha
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    const fichaId = searchParams.get("fichaId")

    if (!clientId && !fichaId) {
      return NextResponse.json(
        { error: "clientId ou fichaId é obrigatório" },
        { status: 400 }
      )
    }

    const parsedClientId = clientId ? parseInt(clientId, 10) : null
    const parsedFichaId = fichaId ? parseInt(fichaId, 10) : null
    
    if ((clientId && isNaN(parsedClientId!)) || (fichaId && isNaN(parsedFichaId!))) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const vinculos = await (prisma as any).gerenteAdministradoraVinculo.findMany({
      where: parsedClientId ? { clientId: parsedClientId } : { fichaId: parsedFichaId },
      include: {
        gerente: {
          select: {
            id: true,
            nome: true,
            email: true,
            celular: true,
            whatsapp: true,
          },
        },
      },
    })

    const data = vinculos.map((v: any) => ({
      vinculoId: v.id,
      id: v.gerente.id,
      nome: v.gerente.nome,
      email: v.gerente.email,
      celular: v.gerente.celular,
      whatsapp: v.gerente.whatsapp,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Erro ao buscar gerentes vinculados:", error)
    return NextResponse.json(
      { error: "Erro ao buscar gerentes vinculados" },
      { status: 500 }
    )
  }
}

// POST - Vincula um gerente a um client ou ficha
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, fichaId, gerenteId } = body

    if (!clientId && !fichaId) {
      return NextResponse.json(
        { error: "clientId ou fichaId é obrigatório" },
        { status: 400 }
      )
    }

    if (!gerenteId) {
      return NextResponse.json(
        { error: "gerenteId é obrigatório" },
        { status: 400 }
      )
    }

    const parsedClientId = clientId ? parseInt(String(clientId), 10) : null
    const parsedFichaId = fichaId ? parseInt(String(fichaId), 10) : null
    const parsedGerenteId = parseInt(String(gerenteId), 10)

    if (isNaN(parsedGerenteId) || (clientId && isNaN(parsedClientId!)) || (fichaId && isNaN(parsedFichaId!))) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const vinculo = await (prisma as any).gerenteAdministradoraVinculo.create({
      data: {
        clientId: parsedClientId,
        fichaId: parsedFichaId,
        gerenteId: parsedGerenteId,
      },
    })

    return NextResponse.json({ vinculoId: vinculo.id })
  } catch (error) {
    console.error("Erro ao vincular gerente:", error)
    return NextResponse.json(
      { error: "Erro ao vincular gerente" },
      { status: 500 }
    )
  }
}

// DELETE - Remove um vínculo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vinculoId = searchParams.get("vinculoId")

    if (!vinculoId) {
      return NextResponse.json(
        { error: "vinculoId é obrigatório" },
        { status: 400 }
      )
    }

    const parsedVinculoId = parseInt(vinculoId, 10)
    if (isNaN(parsedVinculoId)) {
      return NextResponse.json({ error: "vinculoId inválido" }, { status: 400 })
    }

    await (prisma as any).gerenteAdministradoraVinculo.delete({
      where: { id: parsedVinculoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao desvincular gerente:", error)
    return NextResponse.json(
      { error: "Erro ao desvincular gerente" },
      { status: 500 }
    )
  }
}

