import { prisma } from "../../../lib/prisma";

export class AgentTelemetry {
    /**
     * Registra uma métrica de agente de forma segura (não trava o fluxo principal)
     */
    static async log(key: string, conversationId: string, sessionId?: string | null) {
        try {
            // Executa em segundo plano sem await no chamador se preferir, 
            // mas aqui deixamos como async para ser usado com await se necessário.
            await prisma.agentMetric.create({
                data: {
                    key,
                    conversationId,
                    sessionId: sessionId || null,
                },
            });
            console.log(`[AgentTelemetry] 📊 Evento registrado: ${key} para ${conversationId}`);
        } catch (error) {
            // Silencioso para não afetar a aplicação
            console.error(`[AgentTelemetry] ❌ Erro ao registrar métrica (${key}):`, error);
        }
    }

    /**
     * Versão rápida que não aguarda a conclusão (fire-and-forget)
     */
    static fireAndForget(key: string, conversationId: string, sessionId?: string | null) {
        this.log(key, conversationId, sessionId).catch(() => { });
    }
}
