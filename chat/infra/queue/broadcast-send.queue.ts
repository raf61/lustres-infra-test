import { Queue, Worker, ConnectionOptions } from "bullmq";

export type BroadcastSendJob = {
  messageId: string;
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

const logger = {
  info: (...args: unknown[]) => console.info("[BroadcastSendQueue]", ...args),
  error: (...args: unknown[]) => console.error("[BroadcastSendQueue]", ...args),
};

type Globals = typeof globalThis & {
  __broadcastSendQueue?: Queue<BroadcastSendJob>;
  __broadcastSendWorkerStarted?: boolean;
};

const g = globalThis as Globals;

export function getBroadcastSendQueue(): Queue<BroadcastSendJob> {
  if (g.__broadcastSendQueue) return g.__broadcastSendQueue;

  g.__broadcastSendQueue = new Queue<BroadcastSendJob>("chat-broadcast-send", {
    connection: buildConnection(),
  });

  return g.__broadcastSendQueue;
}

export function ensureBroadcastSendWorker(handler: (data: BroadcastSendJob) => Promise<void>) {
  if (g.__broadcastSendWorkerStarted) return;

  const concurrency = Number(process.env.BULLMQ_BROADCAST_CONCURRENCY || 1);
  const limiterMax = Number(process.env.BROADCAST_RATE_LIMIT_MAX || 1);
  const limiterDuration = Number(process.env.BROADCAST_RATE_LIMIT_DURATION || 1400);

  new Worker<BroadcastSendJob>(
    "chat-broadcast-send",
    async (job) => {
      logger.info({ jobId: job.id, messageId: job.data.messageId }, "processing broadcast-send");
      await handler(job.data);
    },
    {
      connection: buildConnection(),
      concurrency,
      limiter: {
        max: limiterMax,
        duration: limiterDuration,
      },
    },
  ).on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "broadcast-send failed");
  });

  g.__broadcastSendWorkerStarted = true;
  logger.info(`Worker started with concurrency ${concurrency} (rate ${limiterMax}/${limiterDuration}ms)`);
}

