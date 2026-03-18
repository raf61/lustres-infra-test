
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { CancelNfeUseCase } from "@/nfe/domain/use-cases/cancel-nfe.usecase"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"]

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
        }

        const userRole = (session.user as any).role
        if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
            return NextResponse.json({ error: "Acesso não autorizado. Apenas MASTER, ADMINISTRADOR ou FINANCEIRO podem cancelar notas." }, { status: 403 })
        }

        const { id } = await params

        const cancelUseCase = new CancelNfeUseCase()
        await cancelUseCase.execute(id)

        return NextResponse.json({ success: true, message: "Nota fiscal cancelada com sucesso" })
    } catch (error: any) {
        console.error("Erro ao cancelar NFe:", error)
        return NextResponse.json(
            { error: error.message || "Erro ao cancelar nota fiscal" },
            { status: 400 }
        )
    }
}
