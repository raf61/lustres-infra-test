import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/chatbot/sessions/active
 * Body: { conversationIds: string[] }
 *
 * Retorna quais conversationIds possuem ChatbotSession ACTIVE.
 * (Usado para indicadores no dashboard do vendedor.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const conversationIds: string[] = Array.isArray(body?.conversationIds)
      ? body.conversationIds.map((id: unknown) => String(id)).filter((id: string) => id.length > 0)
      : []

    if (conversationIds.length === 0) {
      return NextResponse.json({ activeConversationIds: [] })
    }

    const rows = await prisma.chatbotSession.findMany({
      where: {
        conversationId: { in: conversationIds },
        status: "ACTIVE",
      },
      distinct: ["conversationId"],
      select: { conversationId: true },
    })

    return NextResponse.json({
      activeConversationIds: rows.map((r) => r.conversationId),
    })
  } catch (error) {
    console.error("[chatbot][sessions][active]", error)
    return NextResponse.json({ error: "Erro ao buscar sessões ativas" }, { status: 500 })
  }
}

