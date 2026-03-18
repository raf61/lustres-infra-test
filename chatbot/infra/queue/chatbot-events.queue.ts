import { Queue, type ConnectionOptions } from "bullmq";

export type ChatbotEventJob = {
  type: string;
  payload: any;
  occurredAt?: Date;
};

export function buildChatbotConnection(): ConnectionOptions {
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

const g = globalThis as any;

export function getChatbotEventsQueue(): Queue<ChatbotEventJob> {
  if (g.__chatbotEventsQueue) return g.__chatbotEventsQueue;

  g.__chatbotEventsQueue = new Queue<ChatbotEventJob>("chatbot-events-queue", {
    connection: buildChatbotConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
    },
  });

  return g.__chatbotEventsQueue;
}
