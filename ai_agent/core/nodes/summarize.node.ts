import { AgentState } from "../state";
import { getLLM } from "../llm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RemoveMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

export const summarizeNode = async (state: AgentState) => {
    const model = getLLM();
    const summary = state.summary || "";
    const messages = state.messages;

    const prompt = ChatPromptTemplate.fromTemplate(
        `Summarize the conversation so far, keeping important details (client name, phone, intent).
Current summary: {summary}
New lines:
{new_lines}
New summary:`
    );

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const response = await chain.invoke({
        summary,
        new_lines: messages.map((m) => `${m.getType()}: ${m.content}`).join("\n"),
    });

    // Remove mensagens antigas do estado (apenas em memória para esta execução)
    // Mantém as últimas 2
    const deleteMessages = messages
        .slice(0, -2)
        .filter((m) => m.id) // Só remove se tiver ID
        .map((m) => new RemoveMessage({ id: m.id as string }));

    return {
        summary: response,
        messages: deleteMessages,
    };
};
