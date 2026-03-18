import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const pedidoId = parseInt(id);
        const { contratoId } = await req.json();

        // 1. Busca o pedido para saber quem é o cliente
        const pedidoExistente = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            select: { clienteId: true }
        });

        if (!pedidoExistente) {
            return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
        }

        // 2. Se for vincular, valida o contrato
        if (contratoId) {
            const contrato = await prisma.contratoManutencao.findUnique({
                where: { id: parseInt(contratoId) }
            });

            if (!contrato) {
                return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
            }

            if (contrato.clienteId !== pedidoExistente.clienteId) {
                return NextResponse.json({ error: "Este contrato pertence a outro cliente" }, { status: 400 });
            }

            if (contrato.status !== "OK") {
                return NextResponse.json({ error: "Apenas contratos com status OK podem ser vinculados" }, { status: 400 });
            }
        }

        // 3. Atualiza o vínculo
        const updatedPedido = await prisma.pedido.update({
            where: { id: pedidoId },
            data: { contratoId: contratoId ? parseInt(contratoId) : null },
            include: {
                contrato: true
            }
        });

        return NextResponse.json({
            ...updatedPedido,
            isContratoVigente: updatedPedido.contrato
                ? (updatedPedido.contrato.status === "OK" && toDateInputValue(updatedPedido.contrato.dataFim) >= toDateInputValue(new Date()))
                : false
        });
    } catch (error) {
        console.error("[PATCH_PEDIDO_CONTRATO]", error);
        return NextResponse.json({ error: "Erro ao vincular contrato" }, { status: 500 });
    }
}
