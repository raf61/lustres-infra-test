import { MultiAgentState } from "../state";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RemoveMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

const getLLM = () => new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: 0,
});

export const summarizeNode = async (state: MultiAgentState) => {
    const model = getLLM();
    const summary = state.summary || "Nenhum resumo anterior.";
    const messages = state.messages;

    // Se não houver mensagens para resumir, apenas retorna o estado atual
    if (messages.length === 0) {
        return { summary };
    }

    const prompt = ChatPromptTemplate.fromTemplate(
        `Você é um assistente de resumo de conversas de vendas (outbound).
Resuma a conversa até agora, mantendo detalhes essenciais:
- Nome do cliente e condomínio.
- Intenção (agendar, recusou, outro síndico).
- Dados novos colhidos (telefone, data de manutenção).

Resumo atual: {summary}

Novas mensagens:
{new_lines}

Gere o novo resumo consolidado em português, de forma concisa (máximo 100 palavras):`
    );

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const response = await chain.invoke({
        summary,
        new_lines: messages.map((m) => `${m.getType()}: ${m.content}`).join("\n"),
    });

    console.log(`[📝 Conversation Summary Updated] -> "${response.substring(0, 100)}..."`);

    // Remove mensagens antigas para não estourar o contexto
    // Mantém as últimas 20 mensagens para dar contexto imediato aos especialistas
    const deleteMessages = messages
        .slice(0, -20)
        .filter((m) => m.id)
        .map((m) => new RemoveMessage({ id: m.id as string }));

    console.log(`[Summarize Node] New summary generated. Message count to remove: ${deleteMessages.length}`);

    return {
        summary: response,
        messages: deleteMessages,
    };
};

/**
 * Condição para decidir se a conversa deve ser resumida.
 * No multi-agente, como as chamadas são em paralelo, reduzir o histórico é vital.
 */
export const shouldSummarizeMultiAgent = (state: MultiAgentState) => {
    const { messages } = state;
    // Se tiver mais de 20 mensagens, resume para manter os especialistas focados e economizar tokens
    if (messages.length > 20) {
        return "summarize";
    }
    return "parallel_specialists";
};
