import { Queue, Worker, ConnectionOptions } from 'bullmq';

export type SendMessageJob = {
  messageId: string;
};

function buildConnection(): ConnectionOptions {
  const host = process.env.BULLMQ_REDIS_HOST;
  const port = Number(process.env.BULLMQ_REDIS_PORT);
  const username = process.env.BULLMQ_REDIS_USERNAME;
  const password = process.env.BULLMQ_REDIS_PASSWORD;

  if (!host || !port) {
    throw new Error('Missing BULLMQ_REDIS_HOST or BULLMQ_REDIS_PORT');
  }

  return {
    host,
    port,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  };
}

const logger = {
  info: (...args: unknown[]) => console.info('[SendMessageQueue]', ...args),
  error: (...args: unknown[]) => console.error('[SendMessageQueue]', ...args),
};

type Globals = typeof globalThis & {
  __sendMessageQueue?: Queue<SendMessageJob>;
  __sendMessageWorkerStarted?: boolean;
};

const g = globalThis as Globals;

export function getSendMessageQueue(): Queue<SendMessageJob> {
  if (g.__sendMessageQueue) return g.__sendMessageQueue;

  g.__sendMessageQueue = new Queue<SendMessageJob>('chat-send-message', {
    connection: buildConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  });

  return g.__sendMessageQueue;
}

export function ensureSendMessageWorker(handler: (data: SendMessageJob) => Promise<void>) {
  if (g.__sendMessageWorkerStarted) return;

  const concurrency = Number(process.env.BULLMQ_WORKER_CONCURRENCY || 5);

  new Worker<SendMessageJob>(
    'chat-send-message',
    async (job) => {
      logger.info({ jobId: job.id, messageId: job.data.messageId }, 'processing send-message');
      await handler(job.data);
    },
    {
      connection: buildConnection(),
      concurrency,
    },
  ).on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'send-message failed');
  });

  g.__sendMessageWorkerStarted = true;
  logger.info(`Worker started with concurrency ${concurrency}`);
}

