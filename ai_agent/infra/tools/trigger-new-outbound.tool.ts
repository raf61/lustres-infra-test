import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getBroadcastPrepareQueue } from "../../../chat/infra/queue/broadcast-prepare.queue";
import { prisma } from "../../../lib/prisma";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";

export const triggerNewOutboundTool = tool(
    async (input, config) => {
        try {
            console.log(`[Tool:triggerNewOutbound] Iniciando disparo para ${input.phone}`);

            // 2. MOCK: Simular disparo
            console.log(`[Tool:triggerNewOutbound] [MOCK MODE] Disparo simulado!`);
            console.log(`[Tool:triggerNewOutbound] Params: Inbox=${input.inboxId}, Flow=${input.flowId}`);
            console.log(`[Tool:triggerNewOutbound] Target: ${input.name} (${input.phone})`);

            // Simular payload de mensagem
            if (input.templateName) {
                console.log(`[Tool:triggerNewOutbound] Content: Template '${input.templateName}'`);
            } else if (input.message) {
                console.log(`[Tool:triggerNewOutbound] Content: Text '${input.message}'`);
            }

            // Falsificar sucesso para o agente
            const broadcastId = `mock-trigger-${Date.now()}`;
            console.log(`[Tool:triggerNewOutbound] Job 'enfileirado' (mock): ${broadcastId}`);

            // Registrar métrica
            const conversationId = config.configurable?.conversation_id;
            const sessionId = config.configurable?.session_id;
            if (conversationId) {
                AgentTelemetry.fireAndForget("TOOL_NEW_OUTBOUND", conversationId, sessionId);
            }

            console.log(`[Tool:triggerNewOutbound] Job enfileirado: ${broadcastId}`);
            return `Disparo agendado com sucesso via Broadcast Queue. Contato: ${input.name} (${input.phone}), Fluxo: ${input.flowId}`;

        } catch (error: any) {
            console.error(`[Tool:triggerNewOutbound] Erro:`, error);
            return `Erro ao disparar outbound: ${error.message}`;
        }
    },
    {
        name: "trigger_new_outbound",
        description: `Dispara mensagem para um NOVO número de telefone que o contato ACABOU DE INFORMAR na conversa. 
IMPORTANTE: Só use esta ferramenta quando o contato enviar explicitamente um número de telefone na mensagem (ex: "21999887766" ou "o número é 21 99988-7766"). 
NUNCA use esta ferramenta com dados que você já tinha antes - só com números que o contato acabou de digitar.
Se o contato disse que tem o número mas ainda não passou, PERGUNTE o número antes de chamar esta ferramenta.`,
        schema: z.object({
            phone: z.string().describe("Telefone NOVO que o contato acabou de informar na última mensagem (apenas números, com DDD, ex: 5511999999999)"),
            name: z.string().describe("Nome do novo contato (se informado) ou 'Síndico' se não souber o nome"),
            flowId: z.string().describe("ID do Chatbot Flow (use o mesmo flow atual)"),
            inboxId: z.string().describe("ID do Inbox (use o mesmo inbox atual)"),
            clientId: z.number().optional().describe("ID do Cliente (Condomínio) para vincular"),
            message: z.string().optional().describe("Mensagem de texto inicial (só se dentro da janela 24h)"),
            templateName: z.string().optional().describe("Nome do Template WhatsApp"),
            templateLanguage: z.string().optional().describe("Código do idioma (padrão: pt_BR)"),
            templateVariables: z.string().optional().describe("JSON string com variáveis do template"),
        }),
    }
);
