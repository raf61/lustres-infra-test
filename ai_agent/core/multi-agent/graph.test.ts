/**
 * ============================================================
 *  GRAFO DE TESTE (multi-agent)
 *  Idêntico ao graph.ts de produção, mas usa tools MOCK.
 *  Reutiliza o ORCHESTRATOR_SYSTEM_PROMPT de produção —
 *  qualquer ajuste no prompt se reflete automaticamente aqui.
 * ============================================================
 */
import { StateGraph } from "@langchain/langgraph";
import { MultiAgentStateAnnotation, MultiAgentState } from "./state";
import {
    strategySpecialistNode,
    safetySpecialistNode,
    toneSpecialistNode,
    technicalSpecialistNode
} from "./nodes/specialists";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { mockTools } from "./tools.mock";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./nodes/orchestrator";
import { summarizeNode, shouldSummarizeMultiAgent } from "./nodes/summarize";

// ── Orquestrador ligado às mockTools (prompt idêntico ao de produção) ──
const orchestratorTestNode = async (state: MultiAgentState) => {
    const model = new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        model: "gemini-2.5-flash",
        temperature: 0.2,
    });
    const modelWithTools = model.bindTools(mockTools);

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", ORCHESTRATOR_SYSTEM_PROMPT],
        new MessagesPlaceholder("messages"),
    ]);

    const chain = prompt.pipe(modelWithTools);

    const response = await chain.invoke({
        messages: state.messages,
        strategy: state.directives.strategy || "Interaja cordialmente.",
        safety: state.directives.safety || "Nenhuma contra-indicação.",
        tone: state.directives.tone || "Profissional.",
        technical: state.directives.technical || "Use dados padrão da empresa.",
        client_data: JSON.stringify(state.client_data),
        conversation_id: state.conversation_id,
        current_date: new Date().toLocaleString("pt-BR"),
        summary: state.summary ? `RESUMO DA CONVERSA ANTERIOR: ${state.summary}` : "",
    });

    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
        messages: [response],
        usage_report: {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
        }
    };
};

// ─── Grafo de teste ───────────────────────────────────────────
const toolNodeTest = new ToolNode(mockTools);

const builder = new StateGraph(MultiAgentStateAnnotation)
    .addNode("strategy", strategySpecialistNode)
    .addNode("safety", safetySpecialistNode)
    .addNode("tone", toneSpecialistNode)
    .addNode("tech", technicalSpecialistNode)
    .addNode("pre_specialists", async (state) => state)
    .addNode("summarizer", summarizeNode)
    .addNode("composer", orchestratorTestNode)
    .addNode("tools", toolNodeTest)

    .addConditionalEdges("__start__", shouldSummarizeMultiAgent, {
        summarize: "summarizer",
        parallel_specialists: "pre_specialists",
    })

    .addEdge("summarizer", "pre_specialists")

    .addEdge("pre_specialists", "strategy")
    .addEdge("pre_specialists", "safety")
    .addEdge("pre_specialists", "tone")
    .addEdge("pre_specialists", "tech")

    .addEdge("strategy", "composer")
    .addEdge("safety", "composer")
    .addEdge("tone", "composer")
    .addEdge("tech", "composer")

    .addConditionalEdges("composer", toolsCondition, {
        tools: "tools",
        __end__: "__end__"
    })

    .addEdge("tools", "composer");

export const multiAgentTestGraph = builder.compile();
