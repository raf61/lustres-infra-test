import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// Definição do estado usando Annotation (padrão LangGraph JS)
export const AgentStateAnnotation = Annotation.Root({
    // Mensagens da conversa com reducer inteligente (suporta RemoveMessage)
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),

    // Resumo da conversa (substituição)
    summary: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),

    // Metadados da conversa (contexto)
    conversation_id: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),

    // ID da sessão de chatbot ativa
    session_id: Annotation<string | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // ID da mensagem atual processada
    message_id: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),

    // Dados do cliente (Client) salvos em memória
    client_data: Annotation<Record<string, any>>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),

    // Próximo passo definido pelo roteador
    next_step: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "process",
    }),

    // Prompt customizado do fluxo (sobrescreve o default se definido)
    custom_system_prompt: Annotation<string | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // Objetivo Tático (definido pelo Estrategista para este turno)
    tactical_objective: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "Responder cordialmente.",
    }),

    // Logs de análise (para debug do pensamento do estrategista)
    analysis_logs: Annotation<string[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),

    // Relatório de uso de tokens do turno atual (Input + Output)
    usage_report: Annotation<{ prompt: number; completion: number; total: number }>({
        reducer: (x, y) => ({
            prompt: x.prompt + (y.prompt || 0),
            completion: x.completion + (y.completion || 0),
            total: x.total + (y.total || 0)
        }),
        default: () => ({ prompt: 0, completion: 0, total: 0 }),
    }),
});

export type AgentState = typeof AgentStateAnnotation.State;
