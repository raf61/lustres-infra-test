import { NextResponse } from "next/server";
import { GenerateContratoDocxUseCase } from "@/domain/contratos/generate-contrato-docx.usecase";
import { prisma } from "@/lib/prisma";

async function handleGenerate(id: string, customData: any = null) {
    const contratoId = parseInt(id);
    const useCase = new GenerateContratoDocxUseCase();

    // Lógica para salvar no DB se solicitado
    if (customData && customData.__saveToDb) {
        const v1Str = customData.valor_cobrado_formatado_em_reais || "0";
        const v2Str = customData.valor_segundo_ano_formatado || "0";
        const getNumeric = (val: string) => parseFloat(val.replace(/[^\d,]/g, "").replace(",", "."));
        const v1 = getNumeric(v1Str);
        const v2 = getNumeric(v2Str);
        const total = v1 + v2;

        if (!isNaN(total)) {
            await prisma.contratoManutencao.update({
                where: { id: contratoId },
                data: { valorTotal: total }
            });
        }
    }

    const buffer = await useCase.execute(contratoId, customData);

    return new NextResponse(buffer as any, {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename=contrato_${contratoId}.docx`,
        },
    });
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        return await handleGenerate(id);
    } catch (error) {
        console.error("[GET_CONTRATO_DOCX]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro ao gerar documento" },
            { status: 400 }
        );
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const customData = await req.json();
        return await handleGenerate(id, customData);
    } catch (error) {
        console.error("[POST_CONTRATO_DOCX]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro ao gerar documento" },
            { status: 400 }
        );
    }
}
