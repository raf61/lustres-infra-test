import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const docId = Number.parseInt(id, 10)
    if (Number.isNaN(docId)) {
      return NextResponse.json({ error: "ID do documento inválido." }, { status: 400 })
    }

    const doc = await prisma.documentoOperacional.findUnique({
      where: { id: docId },
      select: { url: true },
    })

    if (!doc || !doc.url) {
      return NextResponse.json({ error: "Documento não encontrado ou sem arquivo gerado." }, { status: 404 })
    }

    const signedUrl = await storage.getDownloadUrlFromStoredUrl(doc.url)

    return NextResponse.json({ url: signedUrl ?? doc.url })
  } catch (error) {
    console.error("[documentos-operacionais][download][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível gerar o link de download."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


