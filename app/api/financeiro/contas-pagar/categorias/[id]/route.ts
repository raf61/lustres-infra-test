import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idParam } = await params
        const id = Number(idParam)
        if (isNaN(id)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        const body = await request.json()
        const nome = (body?.nome ?? "").trim()

        if (!nome) {
            return NextResponse.json({ error: "Nome da categoria é obrigatório." }, { status: 400 })
        }

        const updated = await (prisma as any).contaPagarCategoria.update({
            where: { id },
            data: { nome },
        })

        return NextResponse.json(updated)
    } catch (error: any) {
        if (error?.code === "P2002") {
            return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 })
        }
        console.error(`Erro ao atualizar categoria:`, error)
        return NextResponse.json({ error: "Erro ao atualizar categoria." }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idParam } = await params
        const id = Number(idParam)
        if (isNaN(id)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        // O schema define onDelete: SetNull, então deletar a categoria apenas remove a referência nas contas
        await (prisma as any).contaPagarCategoria.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(`Erro ao excluir categoria:`, error)
        return NextResponse.json({ error: "Erro ao excluir categoria." }, { status: 500 })
    }
}
