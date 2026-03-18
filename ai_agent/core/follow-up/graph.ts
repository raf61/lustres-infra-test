import { StateGraph, Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { resolveConversationTool } from "../../infra/tools/resolve-conversation.tool";
import { returnToResearchTool } from "../../infra/tools/return-to-research.tool";
import { handoffTool } from "../../infra/tools/handoff.tool";
import { updateKanbanTool } from "../../infra/tools/update-kanban.tool";
import { markAsLossTool } from "../../infra/tools/mark-as-loss.tool";
import { FOLLOW_UP_JUDGE_PROMPT } from "./prompts";

// --- Definição de Estado Isolado para o Follow-up ---
const FollowUpStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),
    conversation_id: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    session_id: Annotation<string | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    usage: Annotation<{ prompt_tokens: number, completion_tokens: number, total_tokens: number }>({
        reducer: (x, y) => ({
            prompt_tokens: x.prompt_tokens + (y.prompt_tokens || 0),
            completion_tokens: x.completion_tokens + (y.completion_tokens || 0),
            total_tokens: x.total_tokens + (y.total_tokens || 0),
        }),
        default: () => ({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
    })
});

type FollowUpState = typeof FollowUpStateAnnotation.State;

const getLLM = () => new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: 0,
});

const ALL_FOLLOW_UP_TOOLS = [
    resolveConversationTool,
    returnToResearchTool,
    handoffTool,
    updateKanbanTool,
    markAsLossTool
];

const judgeNode = async (state: FollowUpState) => {
    // 1. Identificar sucessos anteriores para informar a IA (evita confusão)
    const successfulToolNames = state.messages
        .filter((m: any) => m.getType() === 'tool' && !m.content.toString().toLowerCase().includes('erro'))
        .map((m: any) => m.name);

    let statusNote = "";
    if (successfulToolNames.length > 0) {
        statusNote = `\n\n⚠️ STATUS ATUAL: Você já executou com sucesso as ferramentas: [${successfulToolNames.join(", ")}]. 
NÃO repita estas chamadas. Se o objetivo era este, finalize sua resposta agora sem chamar novas ferramentas.`;
    }

    const model = getLLM().bindTools(ALL_FOLLOW_UP_TOOLS);

    const response = await model.invoke([
        new SystemMessage(FOLLOW_UP_JUDGE_PROMPT + statusNote),
        ...state.messages,
        new HumanMessage(`ID da Conversa: ${state.conversation_id}\nAnalise o histórico e decida o próximo passo.`)
    ], {
        configurable: {
            conversation_id: state.conversation_id,
            session_id: state.session_id
        }
    });

    // 2. SEGURANÇA NA SAÍDA: Se a IA foi teimosa e tentou repetir uma ferramenta que já deu certo:
    if (response.tool_calls && response.tool_calls.length > 0) {
        const hasRedundantCall = response.tool_calls.some(tc => successfulToolNames.includes(tc.name));
        if (hasRedundantCall) {
            console.log(`[FollowUp Graph] IA tentou repetir ferramenta de sucesso. Abortando loop.`);
            // Retornamos uma resposta vazia ou sem tool_calls para o conditionalEdge entender que acabou
            return {
                messages: [new HumanMessage("Fim da análise (repetição evitada).")],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };
        }
    }

    const metadata = response.response_metadata?.tokenUsage as any;

    return {
        messages: [response],
        usage: {
            prompt_tokens: metadata?.promptTokens || 0,
            completion_tokens: metadata?.completionTokens || 0,
            total_tokens: metadata?.totalTokens || 0,
        }
    };
};

const toolsNode = new ToolNode([
    resolveConversationTool,
    returnToResearchTool,
    handoffTool,
    updateKanbanTool,
    markAsLossTool
]);

const builder = new StateGraph(FollowUpStateAnnotation)
    .addNode("judge", judgeNode)
    .addNode("tools", toolsNode)
    .addEdge("__start__", "judge")
    .addConditionalEdges("judge", toolsCondition, {
        tools: "tools",
        __end__: "__end__"
    })
    .addEdge("tools", "judge"); // Permite chamar mais de uma ferramenta se necessário

export const followUpGraph = builder.compile();
