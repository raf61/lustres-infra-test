import { AgentState } from "../state";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AI_AGENT_CONFIG } from "../config";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { SPECIALIST_WHAT_TO_DO_PROMPT } from "../outbound/prompts";

export const strategistNode = async (state: AgentState) => {
    // Instancia modelo dedicado com temperatura 0 para análise lógica
    const analyticalModel = new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        model: "gemini-2.5-flash",
        temperature: 0,
        maxOutputTokens: 2048,
    });

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", SPECIALIST_WHAT_TO_DO_PROMPT],
        new MessagesPlaceholder("messages"),
        ["user", "Baseado na última mensagem do cliente e no histórico, qual é o ÚNICO objetivo tático para agora? Seja breve."]
    ]);

    const chain = prompt.pipe(analyticalModel);

    // Agora recebemos a AIMessage completa, não string
    const response = await chain.invoke({
        messages: state.messages
    });

    const content = typeof response.content === "string" ? response.content : "";
    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    console.log(`[Strategist Node] Objective: ${content}`);

    return {
        tactical_objective: content,
        analysis_logs: [`[Strategist]: ${content}`],
        usage_report: {
            prompt: usage.promptTokens || 0,
            completion: usage.completionTokens || 0,
            total: usage.totalTokens || 0
        }
    };
};
