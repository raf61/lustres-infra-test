import { AgentState } from "../state";

export const shouldSummarize = (state: AgentState) => {
    const { messages } = state;
    // Se tiver mais de 10 mensagens (arbitrário por enquanto), resume
    if (messages.length > 10) {
        return "summarize";
    }
    return "agent";
};
