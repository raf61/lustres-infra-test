import { Queue, Worker, ConnectionOptions } from "bullmq";

export type BroadcastDispatchContactJob = {
  broadcastId: string;
  inboxId: string;
  chatbotFlowId?: string | null;
  forceChatbotAssign?: boolean;
  keepChatbot?: boolean;
  message: {
    content?: string;
    contentType?: string;
    messageType?: "outgoing" | "template";
    attachments?: Array<{
      fileType: string;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    }>;
    contentAttributes?: {
      inReplyTo?: string;
      items?: Array<{ title: string; value: string; description?: string }>;
      template?: { name: string; languageCode: string; components: any[] };
    };
    assigneeId?: string | null;
  };
  contact: {
    phoneNumber: string;
    contactName?: string | null;
    clientId?: number | null;
    contactId: string;
    conversationId: string;
    contactInboxId?: string | null;
    assigneeId?: string | null;
  };
  recipientId?: string | null;
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
  info: (...args: unknown[]) => console.info("[BroadcastDispatchContactQueue]", ...args),
  error: (...args: unknown[]) => console.error("[BroadcastDispatchContactQueue]", ...args),
};

type Globals = typeof globalThis & {
  __broadcastDispatchContactQueue?: Queue<BroadcastDispatchContactJob>;
  __broadcastDispatchContactWorkerStarted?: boolean;
};

const g = globalThis as Globals;

export function getBroadcastDispatchContactQueue(): Queue<BroadcastDispatchContactJob> {
  if (g.__broadcastDispatchContactQueue) return g.__broadcastDispatchContactQueue;

  g.__broadcastDispatchContactQueue = new Queue<BroadcastDispatchContactJob>(
    "chat-broadcast-dispatch-contact",
    {
      connection: buildConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );

  return g.__broadcastDispatchContactQueue;
}

export function ensureBroadcastDispatchContactWorker(
  handler: (data: BroadcastDispatchContactJob) => Promise<void>
) {
  if (g.__broadcastDispatchContactWorkerStarted) return;

  const concurrency = Number(process.env.BULLMQ_BROADCAST_DISPATCH_CONCURRENCY || 1);

  new Worker<BroadcastDispatchContactJob>(
    "chat-broadcast-dispatch-contact",
    async (job) => {
      logger.info({ jobId: job.id, broadcastId: job.data.broadcastId }, "processing broadcast-dispatch");
      await handler(job.data);
    },
    {
      connection: buildConnection(),
      concurrency,
    }
  ).on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "broadcast-dispatch failed");
  });

  g.__broadcastDispatchContactWorkerStarted = true;
  logger.info(`Worker started with concurrency ${concurrency}`);
}
