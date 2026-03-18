import { ILLMAuditLogger, LLMAuditData } from "./iaudit-logger";

export class ConsoleLLMAuditLogger implements ILLMAuditLogger {
    async log(data: LLMAuditData): Promise<void> {
        const { model, usage, latencyMs, decisions, error, correlationId } = data;

        const status = error ? "❌ FAILED" : "✅ SUCCESS";

        console.log(`\n[LLM-AUDIT] ${status} | Model: ${model} | Latency: ${latencyMs}ms`);
        if (correlationId) console.log(`Trace: ${correlationId}`);
        console.log(`Tokens: IN=${usage.promptTokens} | OUT=${usage.completionTokens} | TOTAL=${usage.totalTokens}`);

        if (decisions && decisions.length > 0) {
            console.log(`Decisions: ${decisions.join(", ")}`);
        }

        if (error) {
            console.error(`Error-Detail: ${error}`);
        }
        console.log(`-------------------------------------------\n`);
    }
}
