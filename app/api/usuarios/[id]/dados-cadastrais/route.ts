import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
  }

  const byUser = await prisma.userDadosCadastrais.findFirst({
    where: { idUser: id },
  })

  if (!byUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ data: byUser })
}

export async function PUT(req: Request, context: RouteContext) {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
  }

  const body = await req.json()

  const createId = body?.id ?? Math.floor(Date.now() / 1000)
  const createData = { ...body, idUser: id, id: createId }

  // Upsert baseado no idUser
  const data = await prisma.userDadosCadastrais.upsert({
    where: { idUser: id },
    update: body,
    create: createData,
  })

  return NextResponse.json({ data })
}

