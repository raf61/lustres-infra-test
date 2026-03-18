import { Queue, ConnectionOptions } from "bullmq";

export type AiAgentInputJob = {
    conversationId: string;
    messageId: string;
    content?: string;
};

function buildConnection(): ConnectionOptions {
    const host = process.env.BULLMQ_REDIS_HOST;
    const port = Number(process.env.BULLMQ_REDIS_PORT);
    const username = process.env.BULLMQ_REDIS_USERNAME;
    const password = process.env.BULLMQ_REDIS_PASSWORD;

    if (!host || !port) {
        throw new Error("Missing BULLMQ_REDIS_HOST or BULLMQ_REDIS_PORT");
    }

    return {
        host,
        port,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
    };
}

export const AI_AGENT_QUEUE_NAME = "ai-agent-input";

let queue: Queue<AiAgentInputJob>;

export const getAiAgentQueue = (): Queue<AiAgentInputJob> => {
    if (!queue) {
        queue = new Queue<AiAgentInputJob>(AI_AGENT_QUEUE_NAME, {
            connection: buildConnection(),
            defaultJobOptions: { removeOnComplete: true }
        });
    }
    return queue;
};
