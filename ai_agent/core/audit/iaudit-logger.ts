export interface LLMAuditData {
    model: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    latencyMs: number;
    decisions?: string[]; // Ferramentas/Caminhos tomados pela IA
    error?: string;
    // Identificador genérico para correlação, sem conhecimento de domínio (business-agnostic)
    correlationId?: string;
}

export interface ILLMAuditLogger {
    log(data: LLMAuditData): Promise<void>;
}
