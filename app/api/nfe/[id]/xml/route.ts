
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { DownloadNfeXmlUseCase } from "@/nfe/domain/use-cases/download-nfe-xml.usecase"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "SAC"]

export async function GET(
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
            return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 })
        }

        const { id } = await params

        const downloadUseCase = new DownloadNfeXmlUseCase()
        const result = await downloadUseCase.execute(id)

        if (result.type === 'url') {
            return NextResponse.json({ url: result.data })
        }

        // Caso seja conteúdo (fallback legado)
        return NextResponse.json({ content: result.data })

    } catch (error: any) {
        console.error("Erro ao baixar XML:", error)
        return NextResponse.json(
            { error: error.message || "Erro ao baixar XML" },
            { status: 400 }
        )
    }
}
