import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveFilialId } from "@/app/api/orcamentos/filial-map"

type Context = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orcamentos/[id]/empresa
 * Altera a empresa de um orçamento e recalcula a filial automaticamente.
 * Apenas MASTER e FINANCEIRO (bloqueado no middleware).
 */
export async function PATCH(req: Request, context: Context) {
    try {
        const { id } = await context.params
        const orcamentoId = Number(id)
        if (!Number.isFinite(orcamentoId)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        const body = await req.json().catch(() => ({}))
        const { empresaId } = body

        if (!empresaId) {
            return NextResponse.json({ error: "empresaId é obrigatório" }, { status: 400 })
        }

        const empresaIdNum = Number(empresaId)
        if (!Number.isFinite(empresaIdNum)) {
            return NextResponse.json({ error: "empresaId inválido" }, { status: 400 })
        }

        // Buscar orçamento com o estado do cliente para recalcular filial
        const orcamento = await prisma.orcamento.findUnique({
            where: { id: orcamentoId },
            select: {
                id: true,
                cliente: { select: { estado: true } },
            },
        })

        if (!orcamento) {
            return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 })
        }

        const clienteEstado = orcamento.cliente?.estado ?? null

        // Recalcular filialId conforme empresa + estado do cliente
        const filialId = await resolveFilialId(prisma as any, empresaIdNum, clienteEstado)
        console.log("FilialId: ", filialId)
        const updated = await prisma.orcamento.update({
            where: { id: orcamentoId },
            data: {
                empresaId: empresaIdNum,
                filialId,
            },
            select: {
                id: true,
                empresaId: true,
                filialId: true,
                empresa: { select: { id: true, nome: true } },
                filial: { select: { id: true, uf: true } },
            },
        })

        return NextResponse.json({
            data: {
                orcamentoId: updated.id,
                empresa: updated.empresa ?? null,
                filialUf: updated.filial?.uf ?? null,
            },
        })
    } catch (error) {
        console.error("[ORCAMENTO_EMPRESA_PATCH]", error)
        return NextResponse.json({ error: "Erro ao atualizar empresa do orçamento" }, { status: 500 })
    }
}
