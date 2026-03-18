import { StateGraph } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./state";
import { agentNode, toolNode, summarizeNode, strategistNode } from "./nodes";
import { shouldSummarize } from "./edges/should-summarize";
import { toolsCondition } from "@langchain/langgraph/prebuilt";

const builder = new StateGraph(AgentStateAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addNode("summarize", summarizeNode)

    .addNode("strategist", strategistNode)

    // Decisão inicial: Resumir ou ir direto para o Agente?
    .addConditionalEdges("__start__", shouldSummarize, {
        summarize: "summarize",
        agent: "strategist", // Passa pelo estrategista primeiro
    })

    // Após resumir, sempre vai para o estrategista definir o novo passo
    .addEdge("summarize", "strategist")

    // Estrategista decide o objetivo -> Agente executa (Ana)
    .addEdge("strategist", "agent")

    // O agente decide: Chamar ferramenta ou responder ao usuário (fim)
    .addConditionalEdges("agent", toolsCondition, {
        tools: "tools",
        __end__: "__end__"
    })

    // Após executar ferramenta, volta para o agente processar o resultado
    .addEdge("tools", "agent");

export const graph = builder.compile();
