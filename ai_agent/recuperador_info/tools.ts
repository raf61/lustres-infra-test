import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { prisma } from "../../lib/prisma";
import { resolveConversationTool } from "../infra/tools/resolve-conversation.tool";
import { handoffTool } from "../infra/tools/handoff.tool";
import { UserNotificationService } from "../infra/notifications/user-notification.service";
import { toDate } from "date-fns-tz";
import { isValid, setDate, format } from "date-fns";

/**
 * Tool para atualizar a data de fim de mandato do síndico.
 */
export const updateMandateExpiryTool = tool(
    async (input, config) => {
        try {
            const { clientId, expiryDate } = input;
            const conversationId = config.configurable?.conversation_id;
            const TIMEZONE = "America/Sao_Paulo";

            let date: Date;

            // Tenta tratar formatos comuns que só mandam mês/ano (MM/YYYY ou YYYY-MM)
            const monthYearRegex = /^(\d{1,2})[\/\-](\d{4})$|^(\d{4})[\/\-](\d{1,2})$/;
            const match = expiryDate.match(monthYearRegex);

            if (match) {
                let month, year;
                if (match[1] && match[2]) {
                    month = parseInt(match[1]);
                    year = parseInt(match[2]);
                } else {
                    year = parseInt(match[3]);
                    month = parseInt(match[4]);
                }
                // Dia 15 no fuso BR
                const dateStr = `${year}-${String(month).padStart(2, '0')}-15T12:00:00`;
                date = toDate(dateStr, { timeZone: TIMEZONE });
            } else {
                // Tenta parse genérico
                date = toDate(expiryDate, { timeZone: TIMEZONE });
                // Se parecer que só tem mês/ano (ex: "2025-12"), toDate pode pegar dia 1
                if (isValid(date) && expiryDate.length <= 7) {
                    date = setDate(date, 15);
                }
            }

            if (!isValid(date)) {
                return `Erro: Data '${expiryDate}' inválida. Use formatos como 'MM/YYYY' ou 'YYYY-MM-DD'.`;
            }

            await prisma.client.update({
                where: { id: clientId },
                data: { dataFimMandato: date }
            });

            const formattedDate = format(date, "dd/MM/yyyy");

            // Identifica o autor do registro (Assignee ou Vendedor do Cliente)
            let authorId: string | null = null;
            if (conversationId) {
                const conv = await prisma.chatConversation.findUnique({
                    where: { id: conversationId },
                    select: { assigneeId: true }
                });
                authorId = conv?.assigneeId || null;
            }

            if (!authorId) {
                const client = await prisma.client.findUnique({
                    where: { id: clientId },
                    select: { vendedorId: true }
                });
                authorId = client?.vendedorId || null;
            }

            if (authorId) {
                await prisma.clientRegistro.create({
                    data: {
                        clientId: clientId,
                        userId: authorId,
                        mensagem: `[i.a]: atualizou a data de fim de mandato para ${formattedDate}.`
                    }
                });
            }

            if (conversationId) {
                await UserNotificationService.notifyResponsible(
                    conversationId,
                    `Atualizou a data de fim de mandato do síndico para ${formattedDate} (fuso BR, dia 15 se apenas mês/ano).`
                );
            }

            console.log(`[Recovery Tool] Mandate expiry updated for client ${clientId}: ${date} (TZ: ${TIMEZONE})`);
            return `Data de fim de mandato atualizada com sucesso para ${formattedDate}.`;
        } catch (error: any) {
            console.error("[updateMandateExpiryTool] Error:", error);
            return `Erro ao atualizar mandato: ${error.message}`;
        }
    },
    {
        name: "update_mandate_expiry",
        description: "Atualiza a data de término do mandato do síndico. Se informado apenas mês/ano, salva no dia 15. Tudo no fuso horário de Brasília.",
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            expiryDate: z.string().describe("Data de término (Ex: '12/2025', '2025-12', ou '15/12/2025')")
        })
    }
);

/**
 * Tool para registrar a administradora informada pelo cliente.
 * Cria um registro no histórico do cliente para ação humana posterior.
 */
export const logAdministratorInfoTool = tool(
    async (input, config) => {
        try {
            const { clientId, administratorName } = input;
            const conversationId = config.configurable?.conversation_id;

            // Identifica o autor do registro (Assignee ou Vendedor do Cliente)
            let authorId: string | null = null;
            if (conversationId) {
                const conv = await prisma.chatConversation.findUnique({
                    where: { id: conversationId },
                    select: { assigneeId: true }
                });
                authorId = conv?.assigneeId || null;
            }

            if (!authorId) {
                const client = await prisma.client.findUnique({
                    where: { id: clientId },
                    select: { vendedorId: true }
                });
                authorId = client?.vendedorId || null;
            }

            if (!authorId) {
                return "Erro: Não foi possível identificar o responsável (Vendedor ou Assignee) para realizar o registro.";
            }

            await prisma.clientRegistro.create({
                data: {
                    clientId: clientId,
                    userId: authorId,
                    mensagem: `[i.a]: a administradora é a ${administratorName}. Associe o cliente à ela.`
                }
            });

            if (conversationId) {
                await UserNotificationService.notifyResponsible(
                    conversationId,
                    `Identificou que a administradora é a ${administratorName}.`
                );
            }

            console.log(`[Recovery Tool] Administrator info logged for client ${clientId}: ${administratorName}`);
            return "Informação da administradora registrada com sucesso no histórico.";
        } catch (error: any) {
            console.error("[logAdministratorInfoTool] Error:", error);
            return `Erro ao registrar administradora: ${error.message}`;
        }
    },
    {
        name: "log_administrator_info",
        description: "Registra o nome da administradora informada pelo cliente no histórico para posterior associação manual.",
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            administratorName: z.string().describe("Nome da administradora informada")
        })
    }
);

// Exportamos as tools que o recuperador usará
export const recoveryTools = [
    updateMandateExpiryTool,
    logAdministratorInfoTool,
    resolveConversationTool,
    handoffTool
];
