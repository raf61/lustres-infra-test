import { NextResponse } from "next/server"
import { auth } from "@/auth"

import { GeneratePropostaPdfUseCase } from "@/domain/orcamento/generate-proposta-pdf-usecase"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const useCase = new GeneratePropostaPdfUseCase()
    const result = await useCase.execute(body)

    return new NextResponse(result.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar PDF."
    console.error("[orcamentos][proposta][POST]", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

