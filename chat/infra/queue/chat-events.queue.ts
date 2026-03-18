import { Queue, Worker, ConnectionOptions } from 'bullmq';

export type ChatEventJob = {
  type: string;  // Pode haver outros eventos além de message.created
  payload: any;
  occurredAt?: Date;
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

const g = globalThis as any;

export function getChatEventsQueue(): Queue<ChatEventJob> {
  if (g.__chatEventsQueue) return g.__chatEventsQueue;

  g.__chatEventsQueue = new Queue<ChatEventJob>('chat-events-queue', {
    connection: buildConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    },
  });

  return g.__chatEventsQueue;
}

export function ensureChatEventsWorker(handler: (data: ChatEventJob) => Promise<void>) {
  if (g.__chatEventsWorkerStarted) return;

  new Worker<ChatEventJob>(
    'chat-events-queue',
    async (job) => {
      await handler(job.data);
    },
    {
      connection: buildConnection(),
      concurrency: Number(process.env.BULLMQ_CHAT_EVENTS_CONCURRENCY || 3),
    }
  ).on('failed', (job, err) => {
    console.error(`[ChatEventsWorker] Job ${job?.id} failed:`, err.message);
  });

  g.__chatEventsWorkerStarted = true;
  console.log('[ChatEventsWorker] Worker initialized');
}


