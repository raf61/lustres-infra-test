import { MultiAgentState } from "../state";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
    STRATEGY_PROMPT,
    SAFETY_PROMPT,
    TONE_PROMPT,
    TECH_PROMPT
} from "../prompts/specialists.prompts";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const getLLM = (temp = 0) => new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: temp,
});

/**
 * ESPECIALISTA: ESTRATÉGIA TÁTICA
 * Decide QUAL o objetivo imediato (Ex: "Pedir contato do novo síndico")
 */
export const strategySpecialistNode = async (state: MultiAgentState) => {
    const model = getLLM(0.1);
    const response = await model.invoke([
        new SystemMessage(STRATEGY_PROMPT),
        ...state.messages,
        new HumanMessage(`<instructions>Analise o histórico (últimas mensagens acima) e o resumo anterior abaixo. Qual é o ÚNICO objetivo tático que o orquestrador deve seguir agora? Responda o objetivo dentro da tag <objective></objective>.</instructions>\n` +
            `Resumo anterior: ${state.summary || "Nenhum resumo anterior."}\n` +
            `Cliente JSON: ${JSON.stringify(state.client_data)}`)
    ]);

    const content = response.content.toString();
    const objective = content.match(/<objective>(.*?)<\/objective>/s)?.[1] || content;

    console.log(`[🧠 AI Thoughts: Strategy] -> ${objective}`);
    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
        directives: { strategy: objective },
        usage_report: {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
        },
        analysis_logs: [`[Spec:Strategy] -> ${objective}`]
    };
};

/**
 * ESPECIALISTA: SEGURANÇA E CONTEXTO DE RISCO
 * Avalia o que pode ou não ser feito baseado no comportamento do lead.
 */
export const safetySpecialistNode = async (state: MultiAgentState) => {
    const model = getLLM(0);
    const response = await model.invoke([
        new SystemMessage(SAFETY_PROMPT),
        ...state.messages,
        new HumanMessage(`<instructions>Avalie o comportamento do lead nas últimas mensagens acima. Baseado nas diretrizes de segurança, o que o orquestrador deve saber ou evitar agora?</instructions>\n` +
            `Resumo anterior: ${state.summary || "Nenhum resumo anterior."}`)
    ]);

    const safetyContext = response.content.toString();

    console.log(`[🛡️ AI Thoughts: Safety & Context] -> ${safetyContext}`);

    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
        directives: { safety: safetyContext },
        usage_report: {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
        }
    };
};

/**
 * ESPECIALISTA: TOM E BRANDING
 * Ajusta a vibe da conversa.
 */
export const toneSpecialistNode = async (state: MultiAgentState) => {
    const model = getLLM(0.3);
    const response = await model.invoke([
        new SystemMessage(TONE_PROMPT),
        ...state.messages,
        new HumanMessage(`<instructions>Analisando as mensagens acima e o resumo abaixo, qual deve ser o TOM da resposta? Responda dentro da tag <tone></tone>.</instructions>\n` +
            `Resumo anterior: ${state.summary || "Nenhum resumo anterior."}`)
    ]);

    const content = response.content.toString();
    const tone = content.match(/<tone>(.*?)<\/tone>/s)?.[1] || content;

    console.log(`[🎭 AI Thoughts: Tone] -> ${tone}`);
    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
        directives: { tone: tone },
        usage_report: {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
        }
    };
};

/**
 * ESPECIALISTA: TÉCNICO E NEGÓCIO
 * Provê fatos (Preços, laudos).
 */
export const technicalSpecialistNode = async (state: MultiAgentState) => {
    const model = getLLM(0);
    const response = await model.invoke([
        new SystemMessage(TECH_PROMPT),
        new HumanMessage("<instructions>Quais dados técnicos são relevantes para este momento? Responda dentro da tag <tech></tech>.</instructions>")
    ]);

    const content = response.content.toString();
    const tech = content.match(/<tech>(.*?)<\/tech>/s)?.[1] || content;

    if (tech !== "Sem dados técnicos necessários neste momento.") {
        console.log(`[⚙️ AI Thoughts: Tech Advice] -> ${tech}`);
    }
    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
        directives: { technical: tech },
        usage_report: {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
        }
    };
};
