import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orcamentos/[id]/filial
 * Altera a filial de um orçamento manualmente.
 * Valida se a filial pertence à empresa do orçamento.
 */
export async function PATCH(req: Request, context: Context) {
    try {
        const { id } = await context.params
        const orcamentoId = Number(id)
        if (!Number.isFinite(orcamentoId)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        const body = await req.json().catch(() => ({}))
        const { filialId } = body

        if (!filialId) {
            return NextResponse.json({ error: "filialId é obrigatório" }, { status: 400 })
        }

        const filialIdNum = Number(filialId)
        if (!Number.isFinite(filialIdNum)) {
            return NextResponse.json({ error: "filialId inválido" }, { status: 400 })
        }

        // Buscar orçamento para verificar a empresa atual
        const orcamento = await prisma.orcamento.findUnique({
            where: { id: orcamentoId },
            select: { empresaId: true },
        })

        if (!orcamento) {
            return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 })
        }

        // Verificar se a filial pertence à empresa do orçamento
        const filial = await prisma.filial.findUnique({
            where: { id: filialIdNum },
            select: { empresaId: true, uf: true },
        })

        if (!filial) {
            return NextResponse.json({ error: "Filial não encontrada" }, { status: 404 })
        }

        if (filial.empresaId !== orcamento.empresaId) {
            return NextResponse.json({ error: "Esta filial não pertence à empresa do orçamento" }, { status: 400 })
        }

        const updated = await prisma.orcamento.update({
            where: { id: orcamentoId },
            data: { filialId: filialIdNum },
            select: {
                id: true,
                filial: { select: { id: true, uf: true } },
            },
        })

        return NextResponse.json({
            data: {
                orcamentoId: updated.id,
                filialUf: updated.filial?.uf ?? null,
            },
        })
    } catch (error) {
        console.error("[ORCAMENTO_FILIAL_PATCH]", error)
        return NextResponse.json({ error: "Erro ao atualizar filial do orçamento" }, { status: 500 })
    }
}
