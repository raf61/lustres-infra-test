import { MultiAgentState } from "../state";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
    STRATEGY_PROMPT,
    SAFETY_PROMPT,
    TONE_PROMPT,
    TECH_PROMPT
} from "../prompts/specialists.prompts";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { prisma } from "../../../../lib/prisma";


const getLLM = (temp = 0) => new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: temp,
});

/**
 * ESPECIALISTA: ESTRATÉGIA TÁTICA
 * Decide QUAL o objetivo imediato (Ex: "Consultar estoque")
 */
export const strategySpecialistNode = async (state: MultiAgentState) => {
    const model = getLLM(0.1);

    // Buscar vendedores ativos para dar contexto à IA
    let activeVendorsContext = "Nenhum vendedor disponível no momento.";
    try {
        const vendors = await prisma.user.findMany({
            where: { role: "VENDEDOR", active: true },
            select: { name: true }
        });
        if (vendors.length > 0) {
            activeVendorsContext = `Vendedores Ativos: ${vendors.map((v: { name: string }) => v.name).join(", ")}`;
        }

    } catch (e) {
        console.error("[Spec:Strategy] Erro ao buscar vendedores:", e);
    }

    const response = await model.invoke([
        new SystemMessage(STRATEGY_PROMPT + `\n\n<contexto_vendedores>\n${activeVendorsContext}\n</contexto_vendedores>`),
        ...state.messages,
        new HumanMessage(`<instructions>Analise o histórico (últimas mensagens acima) e o resumo anterior abaixo. Qual é o ÚNICO objetivo tático que o orquestrador deve seguir agora? Responda o objetivo dentro da tag <objective></objective>.</instructions>\n` +
            `Resumo anterior: ${state.summary || "Nenhum resumo anterior."}\n` +
            `Cliente JSON: ${JSON.stringify(state.client_data)}`)
    ]);


    const content = response.content.toString();
    const objective = content.match(/<objective>([\s\S]*?)<\/objective>/)?.[1] || content;


    console.log(`[🧠 Lustres Thoughts: Strategy] -> ${objective}`);
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
 * ESPECIALISTA: SEGURANÇA E CONTEXTO DE MARCA
 * Avalia o que pode ou não ser feito baseado no comportamento do cliente.
 */
export const safetySpecialistNode = async (state: MultiAgentState) => {
    const model = getLLM(0);
    const response = await model.invoke([
        new SystemMessage(SAFETY_PROMPT),
        ...state.messages,
        new HumanMessage(`<instructions>Avalie o comportamento do cliente nas últimas mensagens acima. Baseado nas diretrizes de segurança e marca, o que o orquestrador deve saber ou evitar agora?</instructions>\n` +
            `Resumo anterior: ${state.summary || "Nenhum resumo anterior."}`)
    ]);

    const safetyContext = response.content.toString();

    console.log(`[🛡️ Lustres Thoughts: Safety & Brand] -> ${safetyContext}`);

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
 * ESPECIALISTA: TOM E DESIGN DE ATENDIMENTO
 * Ajusta a vibe da conversa para ser luxuosa e acolhedora.
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
    const tone = content.match(/<tone>([\s\S]*?)<\/tone>/)?.[1] || content;


    console.log(`[🎭 Lustres Thoughts: Tone] -> ${tone}`);
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
 * ESPECIALISTA: CONSULTORIA TÉCNICA
 * Fornece dicas de iluminação e decoração.
 */
export const technicalSpecialistNode = async (state: MultiAgentState) => {
    const model = getLLM(0);
    const response = await model.invoke([
        new SystemMessage(TECH_PROMPT),
        new HumanMessage("<instructions>Quais conselhos técnicos de iluminação ou decorativos são relevantes para este momento? Responda dentro da tag <tech></tech>.</instructions>")
    ]);

    const content = response.content.toString();
    const tech = content.match(/<tech>([\s\S]*?)<\/tech>/)?.[1] || content;


    if (tech !== "Sem dados técnicos necessários neste momento.") {
        console.log(`[⚙️ Lustres Thoughts: Tech & Decor Advice] -> ${tech}`);
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
