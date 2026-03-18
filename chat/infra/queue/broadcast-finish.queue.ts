import { Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { buildBullmqConnection } from "./bullmq-connection";

export type BroadcastFinishJob = {
  broadcastId: string;
};

const logger = {
  info: (...args: unknown[]) => console.info("[BroadcastFinishQueue]", ...args),
  error: (...args: unknown[]) => console.error("[BroadcastFinishQueue]", ...args),
};

type Globals = typeof globalThis & {
  __broadcastFinishQueue?: Queue<BroadcastFinishJob>;
  __broadcastFinishWorkerStarted?: boolean;
};

const g = globalThis as Globals;

export function getBroadcastFinishQueue(): Queue<BroadcastFinishJob> {
  if (g.__broadcastFinishQueue) return g.__broadcastFinishQueue;

  g.__broadcastFinishQueue = new Queue<BroadcastFinishJob>("chat-broadcast-finish", {
    connection: buildBullmqConnection(),
  });

  return g.__broadcastFinishQueue;
}

export function ensureBroadcastFinishWorker(handler: (data: BroadcastFinishJob) => Promise<void>) {
  if (g.__broadcastFinishWorkerStarted) return;

  const concurrency = Number(process.env.BULLMQ_BROADCAST_FINISH_CONCURRENCY || 1);

  new Worker<BroadcastFinishJob>(
    "chat-broadcast-finish",
    async (job) => {
      logger.info({ jobId: job.id, broadcastId: job.data.broadcastId }, "processing broadcast-finish");
      await handler(job.data);
    },
    {
      connection: buildBullmqConnection(),
      concurrency,
    }
  ).on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "broadcast-finish failed");
  });

  g.__broadcastFinishWorkerStarted = true;
  logger.info(`Worker started with concurrency ${concurrency}`);
}
