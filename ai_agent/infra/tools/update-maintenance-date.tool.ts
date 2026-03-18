import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { prisma } from "../../../lib/prisma";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";
import { resolveAllClientConversations } from "@/chat/application/resolve-all-client-conversations";

export const updateMaintenanceDateTool = tool(
    async (input, config) => {
        try {
            if (!input.clientId) return "Erro: Client ID é obrigatório.";

            const clientIdNum = Number(input.clientId);
            if (isNaN(clientIdNum)) {
                return `Erro: Client ID inválido ('${input.clientId}'). Deve ser um número.`;
            }

            const parsed = new Date(input.maintenanceDate);
            if (isNaN(parsed.getTime())) {
                return `Erro: Data inválida recebida: '${input.maintenanceDate}'. Use o formato YYYY-MM-DD.`;
            }

            // Proteção contra datas futuras (nunca deveria chegar, mas garantimos)
            if (parsed > new Date()) {
                return `Erro: A data '${input.maintenanceDate}' está no futuro. Verifique o ano informado pelo cliente.`;
            }

            // Ler dados atuais para salvar histórico
            const currentClient = await prisma.client.findUnique({
                where: { id: clientIdNum },
                select: { ultimaManutencao: true, observacao: true }
            });

            if (!currentClient) {
                return `Erro: Cliente ID ${input.clientId} não encontrado.`;
            }

            // Montar nova observação se já existia uma data diferente
            let newObservation = currentClient.observacao || "";
            if (currentClient.ultimaManutencao && currentClient.ultimaManutencao.getTime() !== parsed.getTime()) {
                const oldDateStr = currentClient.ultimaManutencao.toLocaleDateString("pt-BR");
                const historyEntry = ` | [i.a] Manutenção anterior: ${oldDateStr}`;
                if (!newObservation.includes(historyEntry)) {
                    newObservation += historyEntry;
                }
            }

            await prisma.client.update({
                where: { id: clientIdNum },
                data: {
                    ultimaManutencao: parsed,
                    observacao: newObservation
                },
            });

            // Resolver todas as conversas abertas deste cliente (em background para não atrasar a IA)
            resolveAllClientConversations(clientIdNum).catch(err =>
                console.error(`[UpdateMaintenanceDate] Erro ao resolver conversas em background:`, err)
            );

            const conversationId = config.configurable?.conversation_id;
            const sessionId = config.configurable?.session_id;
            if (conversationId) {
                AgentTelemetry.fireAndForget("TOOL_UPDATE_MAINTENANCE", conversationId, sessionId);
            }

            console.log(`[UpdateMaintenanceDate] Client ${clientIdNum} updated to ${parsed.toISOString()}. Resolved conversations.`);
            return "Data de manutenção atualizada com sucesso. Todas as conversas abertas deste cliente também foram resolvidas.";
        } catch (error: any) {
            console.error("[UpdateMaintenanceDate] Error:", error);
            if (error.code === "P2025") {
                return `Erro: Cliente ID ${input.clientId} não encontrado.`;
            }
            return `Erro técnico: ${error.message}`;
        }
    },
    {
        name: "update_maintenance_date",
        description: `Atualiza a data da última manutenção (laudo) do cliente.
DATA E HORÁRIO ATUAL: ${new Date().toLocaleString("pt-BR")}.
USE QUANDO: O cliente confirmar que já fez o laudo e informar a data.
IMPORTANTE: Converta a data informada para o formato YYYY-MM-DD antes de chamar.
- Se o cliente informar apenas o mês, use o DIA 15 como padrão (ex: "maio" -> YYYY-05-15).
- "dezembro" (sem ano) → se dezembro ainda não chegou este ano, use o ano passado.
`,
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            maintenanceDate: z.string().describe("Data no formato YYYY-MM-DD (ex: '2025-12-15')"),
        }),
    }
);
