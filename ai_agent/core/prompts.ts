import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { OUTBOUND_VENDAS_PRESET } from "./presets";

export const AGENT_SYSTEM_PROMPT = OUTBOUND_VENDAS_PRESET.systemPrompt;

/** 
 * Gera prompt dinâmico baseado no preset do fluxo.
 * O worker passa o preset.systemPrompt aqui.
 */
export const getAgentPromptDynamic = (customPrompt?: string | null) => {
    // customPrompt vem do preset hardcoded (não do banco)
    const systemPrompt = customPrompt || AGENT_SYSTEM_PROMPT;
    return ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        new MessagesPlaceholder("messages"),
    ]);
};
