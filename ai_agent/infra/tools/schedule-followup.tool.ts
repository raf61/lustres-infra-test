import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { PrismaClientRepository } from "../../../chat/infra/repositories/prisma-client-repository";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";

const clientRepository = new PrismaClientRepository();

export const scheduleFollowupTool = tool(
    async (input, config) => {
        try {
            // O LLM pode mandar datas em formatos variados. O ideal é instruir no prompt para mandar ISO.
            const date = new Date(input.datetime);
            if (isNaN(date.getTime())) {
                return "Erro: Formato de data inválido. Use ISO 8601 (Ex: 2024-12-31T15:00:00).";
            }

            await clientRepository.update(Number(input.clientId), {
                dataContatoAgendado: date,
            });

            // Registrar métrica
            const conversationId = config.configurable?.conversation_id;
            const sessionId = config.configurable?.session_id;
            if (conversationId) {
                AgentTelemetry.fireAndForget("SCHEDULE_FOLLOWUP", conversationId, sessionId);
            }

            return `Agendamento confirmado para ${date.toLocaleString("pt-BR")}.`;
        } catch (error: any) {
            return `Erro ao agendar: ${error.message}`;
        }
    },
    {
        name: "schedule_followup",
        description: `Agenda um retorno ou contato futuro com o cliente.
DATA E HORÁRIO ATUAL: ${new Date().toLocaleString("pt-BR")}. Use para calcular datas relativas ("semana que vem", "mês que vem", etc).`,
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            datetime: z.string().describe("Data e hora para o agendamento em formato ISO 8601 (YYYY-MM-DDTHH:mm:ss)"),
        }),
    }
);
