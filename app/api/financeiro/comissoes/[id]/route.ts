import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/financeiro/comissoes/[id] — editar valor e/ou vencimento */
export async function PATCH(req: Request, context: Context) {
    try {
        const { id } = await context.params
        const comissaoId = Number(id)
        if (!Number.isFinite(comissaoId)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        const body = await req.json().catch(() => ({}))
        const { valor, vencimento } = body

        const data: Record<string, any> = {}
        if (valor !== undefined) {
            const v = Number(valor)
            if (!Number.isFinite(v) || v <= 0) {
                return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
            }
            data.valor = v
        }
        if (vencimento !== undefined) {
            const d = new Date(vencimento)
            if (isNaN(d.getTime())) {
                return NextResponse.json({ error: "Vencimento inválido" }, { status: 400 })
            }
            data.vencimento = d
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: "Nada a atualizar" }, { status: 400 })
        }

        const updated = await (prisma as any).comissao.update({
            where: { id: comissaoId },
            data,
        })

        // Sincroniza ContaPagar vinculada
        const contaPagar = await (prisma as any).contaPagar.findFirst({
            where: { comissaoId },
        })
        if (contaPagar) {
            await (prisma as any).contaPagar.update({
                where: { id: contaPagar.id },
                data: {
                    ...(data.valor !== undefined ? { valor: data.valor } : {}),
                    ...(data.vencimento !== undefined ? { vencimento: data.vencimento } : {}),
                },
            })
        }

        return NextResponse.json({ data: updated })
    } catch (error) {
        console.error("[COMISSAO_PATCH]", error)
        return NextResponse.json({ error: "Erro ao atualizar comissão" }, { status: 500 })
    }
}

/** DELETE /api/financeiro/comissoes/[id] — apagar comissão e ContaPagar vinculada */
export async function DELETE(_req: Request, context: Context) {
    try {
        const { id } = await context.params
        const comissaoId = Number(id)
        if (!Number.isFinite(comissaoId)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        // Apaga ContaPagar vinculada junto com a comissão (mantém sincronizado)
        await (prisma as any).contaPagar.deleteMany({
            where: { comissaoId },
        })

        await (prisma as any).comissao.delete({ where: { id: comissaoId } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[COMISSAO_DELETE]", error)
        return NextResponse.json({ error: "Erro ao apagar comissão" }, { status: 500 })
    }
}
