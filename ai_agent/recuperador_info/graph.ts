import { StateGraph } from "@langchain/langgraph";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage, AIMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { recoveryTools } from "./tools";
import { RECOVERY_STRATEGY_PROMPT, RECOVERY_ORCHESTRATOR_PROMPT } from "./prompts";

// Reutilizamos a estrutura de estado do MultiAgent para manter compatibilidade com o Worker
const RecoveryStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),
    client_data: Annotation<Record<string, any>>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),
    conversation_id: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    summary: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    directives: Annotation<{
        strategy?: string;
    }>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),
    usage_report: Annotation<{ prompt: number; completion: number; total: number }>({
        reducer: (x, y) => ({
            prompt: x.prompt + (y.prompt || 0),
            completion: x.completion + (y.completion || 0),
            total: x.total + (y.total || 0),
        }),
        default: () => ({ prompt: 0, completion: 0, total: 0 }),
    }),
});

type RecoveryState = typeof RecoveryStateAnnotation.State;

const getLLM = (temp = 0) => new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: temp,
});

// Nó de Estratégia (Simplificado)
const strategyNode = async (state: RecoveryState) => {
    const model = getLLM(0.1);
    const response = await model.invoke([
        new SystemMessage(RECOVERY_STRATEGY_PROMPT),
        ...state.messages,
        new HumanMessage(`Analise a conversa. Qual o objetivo agora? Resuma em uma frase dentro de <objective></objective>.\nContexto: ${JSON.stringify(state.client_data)}`)
    ]);

    const content = response.content.toString();
    const objective = content.match(/<objective>([\s\S]*?)<\/objective>/)?.[1] || content;
    const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
        directives: { strategy: objective },
        usage_report: {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
        }
    };
};

// Nó de Orquestração (Resposta Final)
const orchestratorNode = async (state: RecoveryState) => {
    const model = getLLM(0.2);
    const modelWithTools = model.bindTools(recoveryTools);

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", RECOVERY_ORCHESTRATOR_PROMPT],
        new MessagesPlaceholder("messages"),
    ]);

    const chain = prompt.pipe(modelWithTools);

    const response = await chain.invoke({
        messages: state.messages,
        strategy: state.directives.strategy || "Coletar dados pendentes.",
        client_data: JSON.stringify(state.client_data),
        current_date: new Date().toLocaleString("pt-BR"),
        summary: state.summary ? `Resumo: ${state.summary}` : "",
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

const builder = new StateGraph(RecoveryStateAnnotation)
    .addNode("strategy", strategyNode)
    .addNode("orchestrator", orchestratorNode)
    .addNode("tools", new ToolNode(recoveryTools))

    .addEdge("__start__", "strategy")
    .addEdge("strategy", "orchestrator")
    .addConditionalEdges("orchestrator", toolsCondition, {
        tools: "tools",
        __end__: "__end__"
    })
    .addEdge("tools", "orchestrator");

export const recuperadorGraph = builder.compile();
