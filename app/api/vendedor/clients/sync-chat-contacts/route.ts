import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { BulkSyncChatContactsUseCase } from "@/chat/application/bulk-sync-chat-contacts.usecase"

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { clientIds } = body

        if (!Array.isArray(clientIds) || clientIds.length === 0) {
            return NextResponse.json({ error: "IDs dos clientes não fornecidos." }, { status: 400 })
        }

        const useCase = new BulkSyncChatContactsUseCase(prisma as any)
        const result = await useCase.execute({ clientIds })

        return NextResponse.json({
            success: true,
            data: result
        })

    } catch (error) {
        console.error("[BulkSyncChatContacts API] Error:", error)
        const message = error instanceof Error ? error.message : "Erro interno ao sincronizar vínculos."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
