import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { prisma } from '../../lib/prisma';
import { releaseClientFromVendor } from '../../domain/client/vendor-assignment-rules';
import { Prisma, PrismaClient } from '@prisma/client';

export type ReturnToResearchInput = {
    clientId: number;
    userId: string;
    reason?: string;
};

// Helpers de Normalização (Idênticos aos da sua Rota Original)
const normalizeCnpj = (cnpj: string) => cnpj.trim().replace(/\D/g, "");
const formatCnpj = (cnpj: string) => {
    const digits = cnpj.trim().replace(/\D/g, "");
    if (digits.length !== 14) return cnpj;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

export class ReturnToResearchUseCase {
    constructor(private readonly conversationRepository: IConversationRepository) { }

    async execute(input: ReturnToResearchInput) {
        const { clientId, userId, reason = "Retornado para pesquisa" } = input;

        // 1. BUSCA DE DADOS (SELECT IDÊNTICO AO DA ROTA ORIGINAL)
        const client = await prisma.client.findUnique({
            where: { id: clientId },
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

        if (!client) {
            throw new Error("Cliente não encontrado");
        }



        // 3. TRAVA DE DUPLICIDADE (QUERY RAW DA ROTA ORIGINAL)
        const normalizedCnpjValue = normalizeCnpj(client.cnpj);
        const fichaExistenteCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM "Ficha" 
        WHERE regexp_replace(cnpj, '\\D', '', 'g') = regexp_replace(${client.cnpj}, '\\D', '', 'g')
        AND "fichaStatus" = 'EM_PESQUISA'
      ) as exists
    `;

        if (fichaExistenteCheck?.[0]?.exists) {
            throw new Error("Este cliente já possui uma ficha ativa em processo de pesquisa.");
        }

        // 4. TRANSAÇÃO (LÓGICA LINHA POR LINHA)
        return await prisma.$transaction(async (tx: any) => {
            // 4.1 Liberar cliente do vendedor (Procedimento centralizado)
            await releaseClientFromVendor(tx, clientId, reason);

            // 4.2 Limpar estado do Kanban
            await tx.$executeRaw`DELETE FROM "ClientKanbanEstado" WHERE "clientId" = ${clientId}`;

            // 4.3 Setup de Dados da Ficha (Cópia exata dos 24 campos)
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
                    },
                });
                fichaId = created.id;
            }

            // 4.4 Gerenciamento de Gerentes (Transferência de vínculos original)
            if (client.gerentesAdministradora.length > 0) {
                // Remove duplicados na ficha antes de transferir
                await tx.gerenteAdministradoraVinculo.deleteMany({
                    where: {
                        fichaId,
                        gerenteId: { in: client.gerentesAdministradora.map(g => g.gerenteId) },
                    },
                });

                // Transfere cada gerente do cliente para a ficha
                for (const g of client.gerentesAdministradora as any[]) {
                    await tx.gerenteAdministradoraVinculo.update({
                        where: { clientId_gerenteId: { clientId: client.id, gerenteId: g.gerenteId } },
                        data: { fichaId, clientId: null },
                    });
                }
            }

            // 4.5 Gravação de Log (Tipo RETORNADO)
            await tx.fichaLog.create({
                data: {
                    fichaId,
                    tipo: "RETORNADO",
                    userId: userId,
                },
            });

            return { success: true, clientId, fichaId };
        });
    }
}
