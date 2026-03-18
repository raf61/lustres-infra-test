import { StateGraph } from "@langchain/langgraph";
import { MultiAgentStateAnnotation } from "./state";
import {
    strategySpecialistNode,
    safetySpecialistNode,
    toneSpecialistNode,
    technicalSpecialistNode
} from "./nodes/specialists";
import { orchestratorComposerNode } from "./nodes/orchestrator";
import { summarizeNode, shouldSummarizeMultiAgent } from "./nodes/summarize";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { tools } from "../tools";

// Nó de ferramentas (usando o prebuilt do LangGraph)
const toolNode = new ToolNode(tools);

const builder = new StateGraph(MultiAgentStateAnnotation)
    // 1. ESPECIALISTAS (Rodam em paralelo)
    .addNode("strategy", strategySpecialistNode)
    .addNode("safety", safetySpecialistNode)
    .addNode("tone", toneSpecialistNode)
    .addNode("tech", technicalSpecialistNode)

    // Nó intermediário para permitir paralelismo de saída após condicional
    .addNode("pre_specialists", async (state) => state)

    // 2. SUMARIZADOR (Opcional, roda se o histórico estiver longo)
    .addNode("summarizer", summarizeNode)

    // 3. ORQUESTRADOR (O compositor final que usa as diretivas)
    .addNode("composer", orchestratorComposerNode)

    // 4. FERRAMENTAS
    .addNode("tools", toolNode)

    // --- CONEXÕES ---

    // Começamos decidindo se precisamos resumir ou ir direto para os especialistas
    .addConditionalEdges("__start__", shouldSummarizeMultiAgent, {
        summarize: "summarizer",
        parallel_specialists: "pre_specialists",
    })

    // Se resumir, depois vai para o gateway
    .addEdge("summarizer", "pre_specialists")

    // Do gateway, dispara todos os especialistas juntos
    .addEdge("pre_specialists", "strategy")
    .addEdge("pre_specialists", "safety")
    .addEdge("pre_specialists", "tone")
    .addEdge("pre_specialists", "tech")

    // Quando todos terminarem de dar seus conselhos, o compositor assume
    .addEdge("strategy", "composer")
    .addEdge("safety", "composer")
    .addEdge("tone", "composer")
    .addEdge("tech", "composer")

    // O compositor decide se termina ou se chama ferramenta
    .addConditionalEdges("composer", toolsCondition, {
        tools: "tools",
        __end__: "__end__"
    })

    // Se chamar ferramenta, o resultado volta para o compositor processar a mensagem final
    .addEdge("tools", "composer");

export const multiAgentGraph = builder.compile();
