import { AgentState } from "../state";
import { getLLM } from "../llm";
import { getAgentPromptDynamic, AGENT_SYSTEM_PROMPT } from "../prompts";
import { SPECIALIST_TONE_PROMPT, SPECIALIST_NOT_TO_DO_PROMPT } from "../outbound/prompts";
import { tools } from "../tools";

export const agentNode = async (state: AgentState, config?: any) => {
    const model = getLLM();

    // 1. Recupera o prompt base (custom ou default)
    const baseSystemPrompt = state.custom_system_prompt || AGENT_SYSTEM_PROMPT;

    // 2. Enriquece com a estratégia definida pelo Estrategista
    const tacticalObjective = state.tactical_objective || "Responda cordialmente.";

    const enrichedSystemPrompt = `
${baseSystemPrompt}

=============================================================================
🔴 INSTRUÇÃO TÁTICA PRIORITÁRIA (DO ESTRATEGISTA)
Sua meta IMEDIATA para esta mensagem é:
"${tacticalObjective}"

Não desvie disto. Use o tom abaixo para moldar a resposta.
=============================================================================

${SPECIALIST_TONE_PROMPT}

# RESTRIÇÕES DE SEGURANÇA (O QUE NÃO FAZER)
${SPECIALIST_NOT_TO_DO_PROMPT}
    `;

    // 3. Cria o template de prompt com o sistema enriquecido
    const prompt = getAgentPromptDynamic(enrichedSystemPrompt);

    const modelWithTools = model.bindTools(tools);
    const chain = prompt.pipe(modelWithTools);

    const response = await chain.invoke({
        messages: state.messages,
        summary: state.summary || "No summary yet.",
        client_data: JSON.stringify(state.client_data || {}),
        conversation_id: state.conversation_id,
        current_date: new Date().toLocaleString("pt-BR"),
    }, {
        configurable: {
            ...config?.configurable,
            conversation_id: state.conversation_id,
            session_id: state.session_id
        }
    });

    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
        messages: [response],
        usage_report: {
            prompt: usage.promptTokens || 0,
            completion: usage.completionTokens || 0,
            total: usage.totalTokens || 0
        }
    };
};
