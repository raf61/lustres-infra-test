import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"

type RouteContext = { params: Promise<{ id: string }> }

const DEFAULT_USER_ID = "1"

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    const anexos = await prisma.visitaAnexo.findMany({
      where: { visitaId },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, createdAt: true },
    })

    return NextResponse.json({ data: anexos })
  } catch (error) {
    console.error("[visitas][anexos][GET]", error)
    return NextResponse.json({ error: "Erro ao listar anexos." }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    const visita = await prisma.visitaTecnica.findUnique({
      where: { id: visitaId },
      select: { id: true, status: true },
    })

    if (!visita) {
      return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 })
    }

    if (visita.status === "FINALIZADO" || visita.status === "CANCELADO") {
      return NextResponse.json({ error: "Visita já finalizada ou cancelada." }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })
    }

    let buffer = Buffer.from(await file.arrayBuffer())
    let contentType = file.type || "application/octet-stream"
    let ext = file.name.split(".").pop() || "bin"

    // Otimização de Imagem se for imagem
    const isImage = file.type.startsWith("image/")
    if (isImage) {
      try {
        const sharp = (await import("sharp")).default
        const optimized = await sharp(buffer)
          .resize({ width: 1280, withoutEnlargement: true }) // Redimensiona para um tamanho razoável
          .webp({ quality: 75 }) // Converte para WebP com qualidade média (75)
          .toBuffer()

        buffer = optimized
        contentType = "image/webp"
        ext = "webp"
      } catch (sharpError) {
        console.error("Erro ao otimizar imagem com sharp, enviando original:", sharpError)
        // Se falhar a otimização, envia a original como fallback
      }
    }

    const key = `visitas/${visitaId}/anexos/${Date.now()}.${ext}`

    const url = await storage.uploadPublicObject({
      key,
      contentType,
      body: buffer,
    })

    const anexo = await prisma.visitaAnexo.create({
      data: { visitaId, url, userId: DEFAULT_USER_ID },
      select: { id: true, url: true, createdAt: true },
    })

    return NextResponse.json({ data: anexo }, { status: 201 })
  } catch (error) {
    console.error("[visitas][anexos][POST]", error)
    return NextResponse.json({ error: "Erro ao salvar anexo." }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const anexoId = Number.parseInt(searchParams.get("anexoId") ?? "", 10)
    if (Number.isNaN(anexoId)) {
      return NextResponse.json({ error: "anexoId inválido." }, { status: 400 })
    }

    const visita = await prisma.visitaTecnica.findUnique({
      where: { id: visitaId },
      select: { status: true },
    })

    if (!visita) {
      return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 })
    }

    if (visita.status === "FINALIZADO" || visita.status === "CANCELADO") {
      return NextResponse.json({ error: "Visita já finalizada ou cancelada." }, { status: 400 })
    }

    await prisma.visitaAnexo.delete({ where: { id: anexoId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[visitas][anexos][DELETE]", error)
    return NextResponse.json({ error: "Erro ao remover anexo." }, { status: 500 })
  }
}

