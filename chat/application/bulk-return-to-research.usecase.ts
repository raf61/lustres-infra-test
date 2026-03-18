import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { prisma } from '../../lib/prisma';
import { releaseClientsFromVendorBatch } from '../../domain/client/vendor-assignment-rules';
import { Prisma, PrismaClient } from '@prisma/client';

export type BulkReturnToResearchInput = {
    clientIds: number[];
    userId: string;
    reason?: string;
};

export type BulkReturnToResearchOutput = {
    processed: number;
    success: number;
    errors: { clientId: number; error: string }[];
};

// Helpers de Normalização
const normalizeCnpj = (cnpj: string) => cnpj.trim().replace(/\D/g, "");
const formatCnpj = (cnpj: string) => {
    const digits = cnpj.trim().replace(/\D/g, "");
    if (digits.length !== 14) return cnpj;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

export class BulkReturnToResearchUseCase {
    constructor(private readonly conversationRepository: IConversationRepository) { }

    async execute(input: BulkReturnToResearchInput): Promise<BulkReturnToResearchOutput> {
        const { clientIds: rawIds, userId, reason = "Retornado para pesquisa (Bulk)" } = input;

        if (!rawIds || rawIds.length === 0) {
            return { processed: 0, success: 0, errors: [] };
        }

        const clientIds = Array.from(new Set(rawIds));

        const output: BulkReturnToResearchOutput = {
            processed: clientIds.length,
            success: 0,
            errors: []
        };

        // 1. BUSCA DE DADOS EM BLOCO
        const allClients = await prisma.client.findMany({
            where: { id: { in: clientIds } },
            select: {
                id: true,
                cnpj: true,
                vendedorId: true,
                categoria: true,
                razaoSocial: true,
                ultimaManutencao: true,
                cep: true,
                logradouro: true,
                numero: true,
                complemento: true,
                bairro: true,
                estado: true,
                cidade: true,
                telefoneCondominio: true,
                celularCondominio: true,
                nomeSindico: true,
                telefoneSindico: true,
                dataInicioMandato: true,
                dataFimMandato: true,
                dataAniversarioSindico: true,
                emailSindico: true,
                nomePorteiro: true,
                telefonePorteiro: true,
                quantidadeSPDA: true,
                observacao: true,
                dataContatoAgendado: true,
                administradoraId: true,
                gerentesAdministradora: {
                    select: { gerenteId: true },
                },
            },
        });

        // 2. FILTRAGEM E VALIDAÇÃO INICIAL
        const validClients = [];
        for (const clientId of clientIds) {
            const client = allClients.find(c => c.id === clientId);
            if (!client) {
                output.errors.push({ clientId, error: "Cliente não encontrado" });
                continue;
            }

            if (client.categoria !== "EXPLORADO" && client.categoria !== "AGENDADO") {
                output.errors.push({ clientId, error: "Apenas clientes livres (EXPLORADO/AGENDADO) podem ser retornados para pesquisa" });
                continue;
            }
            validClients.push(client);
        }

        if (validClients.length === 0) return output;

        // 3. CHECAR FICHAS ATIVAS EM BLOCO (Trava de duplicidade usando Raw SQL para paridade total)
        const cnpjs = validClients.map(c => normalizeCnpj(c.cnpj));

        // Query identica à logica unitária: normaliza no banco para comparar
        const activeFichasCheck = await prisma.$queryRaw<Array<{ cnpj_normalized: string }>>`
            SELECT regexp_replace(cnpj, '\\D', '', 'g') as cnpj_normalized
            FROM "Ficha"
            WHERE regexp_replace(cnpj, '\\D', '', 'g') IN (${Prisma.join(cnpjs)})
            AND "fichaStatus" = 'EM_PESQUISA'
        `;

        const activeCnpjsSet = new Set(activeFichasCheck.map(f => f.cnpj_normalized));

        const finalClientsToProcess = validClients.filter(client => {
            const normalized = normalizeCnpj(client.cnpj);
            if (activeCnpjsSet.has(normalized)) {
                output.errors.push({ clientId: client.id, error: "Este cliente já possui uma ficha ativa em processo de pesquisa." });
                return false;
            }
            return true;
        });

        if (finalClientsToProcess.length === 0) return output;

        const finalIds = finalClientsToProcess.map(c => c.id);

        // 4. TRANSAÇÃO EM BLOCO
        return await prisma.$transaction(async (tx: any) => {
            // 4.1 Liberar clientes do vendedor em lote (Side effect: limpa dashboard e Kanban)
            await releaseClientsFromVendorBatch(tx, finalIds, reason);

            // 4.2 Processar Fichas e Gerentes
            for (const client of finalClientsToProcess) {
                const normalizedCnpjValue = normalizeCnpj(client.cnpj);
                const formattedCnpjValue = formatCnpj(client.cnpj);

                const existingFicha = await tx.ficha.findFirst({
                    where: {
                        OR: [
                            { cnpj: client.cnpj },
                            { cnpj: normalizedCnpjValue },
                            { cnpj: formattedCnpjValue },
                        ],
                    },
                });

                const fichaData = {
                    razaoSocial: client.razaoSocial,
                    fichaStatus: "EM_PESQUISA" as const,
                    ultimaManutencao: client.ultimaManutencao,
                    cep: client.cep,
                    logradouro: client.logradouro,
                    numero: client.numero,
                    complemento: client.complemento,
                    bairro: client.bairro,
                    estado: client.estado,
                    cidade: client.cidade,
                    telefoneCondominio: client.telefoneCondominio,
                    celularCondominio: client.celularCondominio,
                    nomeSindico: client.nomeSindico,
                    telefoneSindico: client.telefoneSindico,
                    dataInicioMandato: client.dataInicioMandato,
                    dataFimMandato: client.dataFimMandato,
                    dataAniversarioSindico: client.dataAniversarioSindico,
                    emailSindico: client.emailSindico,
                    nomePorteiro: client.nomePorteiro,
                    telefonePorteiro: client.telefonePorteiro,
                    quantidadeSPDA: client.quantidadeSPDA,
                    observacao: client.observacao,
                    dataContatoAgendado: client.dataContatoAgendado,
                    administradoraId: client.administradoraId,
                };

                let fichaId: number;
                if (existingFicha) {
                    const updated = await tx.ficha.update({
                        where: { id: existingFicha.id },
                        data: fichaData,
                    });
                    fichaId = updated.id;
                } else {
                    const created = await tx.ficha.create({
                        data: {
                            cnpj: formattedCnpjValue,
                            ...fichaData,
                        } as any,
                    });
                    fichaId = created.id;
                }

                // 4.3 Gerenciamento de Gerentes (Transferência de vínculos)
                if (client.gerentesAdministradora.length > 0) {
                    const gerenteIds = client.gerentesAdministradora.map(g => g.gerenteId);

                    await tx.gerenteAdministradoraVinculo.deleteMany({
                        where: {
                            fichaId,
                            gerenteId: { in: gerenteIds },
                        },
                    });

                    for (const gerenteId of gerenteIds) {
                        await tx.gerenteAdministradoraVinculo.updateMany({
                            where: { clientId: client.id, gerenteId },
                            data: { fichaId, clientId: null },
                        });
                    }
                }

                // 4.4 Gravação de Log
                await tx.fichaLog.create({
                    data: {
                        fichaId,
                        tipo: "RETORNADO",
                        userId: userId,
                    },
                });

                output.success++;
            }

            return output;
        });
    }
}
