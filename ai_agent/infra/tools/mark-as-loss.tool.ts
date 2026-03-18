import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { prisma } from "../../../lib/prisma";
import { processarPerda } from "@/domain/client/loss-rules";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";
import { UserNotificationService } from "../notifications/user-notification.service";

export const markAsLossTool = tool(
    async (input, config) => {
        try {
            const clientIdNum = Number(input.clientId);
            if (isNaN(clientIdNum)) {
                return `Erro: Client ID inválido ('${input.clientId}'). Deve ser um número.`;
            }

            let ultimaManutencao: Date | null = null;
            if (input.ultimaManutencao) {
                ultimaManutencao = new Date(input.ultimaManutencao);
                if (isNaN(ultimaManutencao.getTime())) {
                    return `Erro: Data inválida: '${input.ultimaManutencao}'. Use formato ISO (ex: 2024-03-01).`;
                }
            }

            // Usa exatamente o mesmo usecase do botão "Perda" no dashboard.
            // processarPerda lê o vendedorId diretamente do banco → nunca perde o vendedor.
            const result = await processarPerda(prisma, {
                clientId: clientIdNum,
                actionType: ultimaManutencao ? "WITH_DATE" : "WITHOUT_DATE",
                ultimaManutencao,
            });

            if (!result.success) {
                return `Erro ao marcar perda: ${result.message}`;
            }

            const conversationId = config.configurable?.conversation_id;
            const sessionId = config.configurable?.session_id;

            if (conversationId) {
                AgentTelemetry.fireAndForget("TOOL_MARK_LOSS", conversationId, sessionId);

                // Notificar o vendedor responsável
                const dateInfo = ultimaManutencao
                    ? ` (última manutenção: ${ultimaManutencao.toLocaleDateString("pt-BR")})`
                    : "";
                UserNotificationService.notifyResponsible(
                    conversationId,
                    `cliente marcado como perda pela I.A${dateInfo}.`
                );
            }

            console.log(`[MarkAsLoss] Client ${clientIdNum} marked as loss (${result.actionType}).`);
            return result.message;

        } catch (error: any) {
            console.error("[MarkAsLoss] Error:", error);
            return `Erro técnico ao marcar perda: ${error.message}`;
        }
    },
    {
        name: "mark_as_loss",
        description: `Marca o cliente como PERDA no sistema(PERDA SIGNIFICA QUE NÃO VAMOS CONSEGUIR VENDER PRA ELE NESSE "CICLO").
Alguns exemplos de quando usar(são apenas exemplos, não seja burro e engessado. Cada caso é um caso.):
- O cliente confirmou que já fez a manutenção com outra empresa E você já salvou a data com update_maintenance_date.
- O fluxo natural da conversa terminou sem interesse (cliente já tem serviço ativo com concorrente).
Na hora de marcar perda, você informa a última data de manutenção dele. Se ele não informou a data, não informe nada. Mas sempre priorize passar a data. Porque se não passar a data, o cliente sai do dashbaord do vendedor atual, mas faz parte. Apenas se certifique de que o cliente realmente não tem mais interesse antes de marcar como perda, e de que realmente não passou a data de última manutenção após perguntarmos.
`,
        schema: z.object({
            clientId: z.number().describe("ID do cliente a ser marcado como perda"),
            ultimaManutencao: z.string().optional().describe(
                "Data da última manutenção informada pelo cliente (ISO 8601, ex: '2024-03-01'). Passe apenas se o cliente confirmou a data."
            ),
        }),
    }
);
