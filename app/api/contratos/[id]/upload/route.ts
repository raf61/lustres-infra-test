import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { uploadPublicObject } from "@/lib/storage/s3"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: contratoId } = await params
        const formData = await req.formData()
        const file = formData.get("file") as File

        if (!file) {
            return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = `contratos/${contratoId}/${Date.now()}-${file.name}`

        const fileUrl = await uploadPublicObject({
            key: filename,
            contentType: file.type,
            body: buffer
        })

        const updated = await prisma.contratoManutencao.update({
            where: { id: parseInt(contratoId) },
            data: { arquivoUrl: fileUrl }
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("[CONTRATO_UPLOAD]", error)
        return NextResponse.json({ error: "Falha ao realizar upload" }, { status: 500 })
    }
}
