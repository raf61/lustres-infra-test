import { Queue, Worker, ConnectionOptions } from "bullmq";

export type BroadcastPrepareJob = {
  broadcastId: string;
  inboxId: string;
  chatbotFlowId?: string | null;
  forceChatbotAssign?: boolean;
  keepChatbot?: boolean;
  contacts: Array<{
    phoneNumber: string;
    contactName?: string | null;
    clientId?: number | null;
  }>;
  invalidContacts: string[];
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
  info: (...args: unknown[]) => console.info("[BroadcastPrepareQueue]", ...args),
  error: (...args: unknown[]) => console.error("[BroadcastPrepareQueue]", ...args),
};

type Globals = typeof globalThis & {
  __broadcastPrepareQueue?: Queue<BroadcastPrepareJob>;
  __broadcastPrepareWorkerStarted?: boolean;
};

const g = globalThis as Globals;

export function getBroadcastPrepareQueue(): Queue<BroadcastPrepareJob> {
  if (g.__broadcastPrepareQueue) return g.__broadcastPrepareQueue;

  g.__broadcastPrepareQueue = new Queue<BroadcastPrepareJob>("chat-broadcast-prepare", {
    connection: buildConnection(),
  });

  return g.__broadcastPrepareQueue;
}

export function ensureBroadcastPrepareWorker(handler: (data: BroadcastPrepareJob) => Promise<void>) {
  if (g.__broadcastPrepareWorkerStarted) return;

  const concurrency = Number(process.env.BULLMQ_BROADCAST_PREPARE_CONCURRENCY || 1);
  const lockDuration = Number(process.env.BULLMQ_BROADCAST_PREPARE_LOCK_MS || 300000);

  new Worker<BroadcastPrepareJob>(
    "chat-broadcast-prepare",
    async (job) => {
      logger.info({ jobId: job.id, broadcastId: job.data.broadcastId }, "processing broadcast-prepare");
      await handler(job.data);
    },
    {
      connection: buildConnection(),
      concurrency,
      lockDuration,
    },
  ).on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "broadcast-prepare failed");
  });

  g.__broadcastPrepareWorkerStarted = true;
  logger.info(`Worker started with concurrency ${concurrency} lockDuration ${lockDuration}ms`);
}

