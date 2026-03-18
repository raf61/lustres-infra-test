import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeGerentes = searchParams.get("includeGerentes") === "true"

    const administradoras = await prisma.administradora.findMany({
      select: {
        id: true,
        nome: true,
        cnpj: true,
        createdAt: true,
        updatedAt: true,
        ...(includeGerentes && {
          gerentes: {
            select: {
              id: true,
              nome: true,
              email: true,
              celular: true,
              whatsapp: true,
            },
          },
          _count: {
            select: {
              clientes: true,
            },
          },
        }),
      },
      orderBy: { nome: "asc" },
    })

    return NextResponse.json({ data: administradoras })
  } catch (error) {
    console.error("[administradoras][GET]", error)
    return NextResponse.json({ error: "Erro ao listar administradoras" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }

    const administradora = await prisma.administradora.create({
      data: {
        nome: body.nome.trim(),
        cnpj: body.cnpj?.trim().replace(/\D/g, "") || null,
        gerentes: body.gerentes?.length > 0 ? {
          create: body.gerentes.map((g: any) => ({
            nome: g.nome?.trim() || "",
            cpf: g.cpf?.replace(/\D/g, "") || null,
            email: g.email?.trim() || null,
            celular: g.celular?.replace(/\D/g, "") || null,
            whatsapp: g.whatsapp?.replace(/\D/g, "") || null,
          })).filter((g: any) => g.nome),
        } : undefined,
      },
      include: {
        gerentes: true,
      },
    })

    return NextResponse.json({ data: administradora }, { status: 201 })
  } catch (error) {
    console.error("[administradoras][POST]", error)
    return NextResponse.json({ error: "Erro ao criar administradora" }, { status: 500 })
  }
}

