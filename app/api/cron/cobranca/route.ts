import { NextResponse } from "next/server"
import { loadCobrancaReguaRules } from "@/chat/application/cobranca-regua/rules"
import { RunCobrancaReguaUseCase } from "@/chat/application/cobranca-regua/run-cobranca-regua.usecase"

const isAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get("x-cron-secret") || request.headers.get("authorization")
  return header === secret || header === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const rules = loadCobrancaReguaRules()
    const useCase = new RunCobrancaReguaUseCase()
    const result = await useCase.execute(rules)

    return NextResponse.json(
      {
        ok: true,
        rules: result.totalRules,
        debitos: result.totalDebitos,
        queued: result.totalQueued,
      },
      { status: 202 },
    )
  } catch (error) {
    console.error("[cobranca][regua][POST]", error)
    const message = error instanceof Error ? error.message : "Erro ao processar régua de cobrança."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}