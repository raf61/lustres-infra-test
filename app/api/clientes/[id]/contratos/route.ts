import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateContratoUseCase } from "@/domain/contratos/create-contrato.usecase";
import { getLoggedUserId } from "@/lib/vendor-dashboard";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clienteId = parseInt(id);

        const contratos = await prisma.contratoManutencao.findMany({
            where: { clienteId },
            include: {
                cliente: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(contratos);
    } catch (error) {
        console.error("[GET_CONTRATOS]", error);
        return NextResponse.json({ error: "Erro ao buscar contratos" }, { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const userId = await getLoggedUserId();

        const useCase = new CreateContratoUseCase();
        const contrato = await useCase.execute({
            ...body,
            clienteId: parseInt(id),
            vendedorId: userId,
            dataInicio: new Date(body.dataInicio),
            dataFim: new Date(body.dataFim),
            status: "PENDENTE",
        });

        return NextResponse.json(contrato, { status: 201 });
    } catch (error) {
        console.error("[POST_CONTRATOS]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro ao criar contrato" },
            { status: 400 }
        );
    }
}
