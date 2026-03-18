import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string; contratoId: string }> }
) {
    try {
        const { contratoId } = await params;
        const body = await req.json();
        const { status, dataInicio, dataFim, valorTotal } = body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (dataInicio) updateData.dataInicio = new Date(dataInicio);
        if (dataFim) updateData.dataFim = new Date(dataFim);
        if (valorTotal !== undefined) updateData.valorTotal = parseFloat(valorTotal);

        const updated = await prisma.contratoManutencao.update({
            where: { id: parseInt(contratoId) },
            data: updateData
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[PATCH_CONTRATO]", error);
        return NextResponse.json({ error: "Erro ao atualizar contrato" }, { status: 500 });
    }
}
