import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const MultiAgentStateAnnotation = Annotation.Root({
    /** Histórico completo da conversa */
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),

    /** Dados complementares do cliente/projeto (contexto global) */
    client_data: Annotation<Record<string, any>>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),

    /** IDs táticos da conversa */
    conversation_id: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    session_id: Annotation<string | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    message_id: Annotation<string | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    /** Resumo comprimido de conversas longas (compatibilidade com worker) */
    summary: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),

    /** DIRETIVAS DOS ESPECIALISTAS (O "Contexto" que eles geram para o Orquestrador) */
    directives: Annotation<{
        strategy?: string;   // O que fazer agora? (Objetivo)
        safety?: string;     // O que NÃO fazer de jeito nenhum (Veto)
        tone?: string;       // Como falar? (Estilo)
        technical?: string;  // Dados técnicos/preços a usar
    }>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),

    /** Relatório de uso de tokens acumulado na rodada */
    usage_report: Annotation<{
        prompt: number;
        completion: number;
        total: number;
    }>({
        reducer: (x, y) => ({
            prompt: x.prompt + (y.prompt || 0),
            completion: x.completion + (y.completion || 0),
            total: x.total + (y.total || 0),
        }),
        default: () => ({ prompt: 0, completion: 0, total: 0 }),
    }),

    /** Log de análise interna (para debug no worker) */
    analysis_logs: Annotation<string[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
});

export type MultiAgentState = typeof MultiAgentStateAnnotation.State;
