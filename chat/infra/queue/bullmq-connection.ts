import type { ConnectionOptions } from "bullmq";

export function buildBullmqConnection(): ConnectionOptions {
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
