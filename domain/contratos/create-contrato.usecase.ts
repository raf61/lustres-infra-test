import { prisma } from "@/lib/prisma";

export type CreateContratoInput = {
    clienteId: number;
    vendedorId?: string;
    dataInicio: Date;
    dataFim: Date;
    valorTotal: number;
    parcelas?: number;
    observacoes?: string;
    arquivoUrl?: string;
    status: string;
};

export class CreateContratoUseCase {
    async execute(input: CreateContratoInput) {
        // Validação básica de datas
        if (input.dataInicio >= input.dataFim) {
            throw new Error("A data de início deve ser anterior à data de fim.");
        }

        const contrato = await prisma.contratoManutencao.create({
            data: {
                clienteId: input.clienteId,
                vendedorId: input.vendedorId,
                dataInicio: input.dataInicio,
                dataFim: input.dataFim,
                valorTotal: input.valorTotal,
                parcelas: input.parcelas,
                observacoes: input.observacoes,
                arquivoUrl: input.arquivoUrl,
                status: input.status,
            },
        });

        return contrato;
    }
}
