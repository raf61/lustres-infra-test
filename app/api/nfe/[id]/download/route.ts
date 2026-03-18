import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { DownloadNfeUseCase } from "@/nfe/domain/use-cases/download-nfe.usecase"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "SAC", "VENDEDOR"]

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userRole = (session.user as any).role
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 })
    }

    const { id } = await params

    try {
        const useCase = new DownloadNfeUseCase()
        const result = await useCase.execute(id)

        if (result.type === 'url') {
            return NextResponse.json({ url: result.data })
        }

        // Caso seja conteúdo (buffer)
        const headers = new Headers()
        headers.set("Content-Type", "application/pdf")
        headers.set("Content-Disposition", `attachment; filename="nfe-${id}.pdf"`)

        return new NextResponse(result.data as any, { status: 200, headers })

    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message || "Error downloading PDF" }, { status: 500 })
    }
}
