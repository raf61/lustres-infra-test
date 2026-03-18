import { NextResponse } from "next/server"
import { randomBytes } from "crypto"

import { storage } from "@/lib/storage"

const MAX_SIZE_MB = 5
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")
    const folder = (form.get("folder") as string | null) || "uploads"

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Envie apenas imagens." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: `Arquivo deve ter no máximo ${MAX_SIZE_MB}MB.` }, { status: 400 })
    }

    const key = `${folder.replace(/\/+$/g, "")}/${Date.now()}-${randomBytes(6).toString("hex")}-${file.name}`
    const url = await storage.uploadPublicObject({
      key,
      contentType: file.type,
      body: Buffer.from(arrayBuffer),
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error("[storage][upload][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível enviar a imagem."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


