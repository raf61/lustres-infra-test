import { Queue, Worker, ConnectionOptions } from 'bullmq';

/**
 * Fila de broadcasts para real-time (Socket.io).
 * 
 * O chat-events.worker adiciona jobs aqui.
 * O Socket.io server consome esta fila.
 */

export type BroadcastJob = {
  type:
    | 'message.created'
    | 'message.updated'
    | 'conversation.created'
    | 'conversation.updated'
    | 'chatbot.session.active'
    | 'chatbot.session.inactive';
  payload: any;
  timestamp: string;
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

export function getBroadcastsQueue(): Queue<BroadcastJob> {
  if (g.__broadcastsQueue) return g.__broadcastsQueue;

  g.__broadcastsQueue = new Queue<BroadcastJob>('chat-broadcasts', {
    connection: buildConnection(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100, // Mantém últimos 100 falhos para debug
    },
  });

  return g.__broadcastsQueue;
}

/**
 * Worker para consumir broadcasts.
 * Será usado pelo Socket.io server.
 */
export function ensureBroadcastsWorker(handler: (data: BroadcastJob) => Promise<void>) {
  if (g.__broadcastsWorkerStarted) return;

  new Worker<BroadcastJob>(
    'chat-broadcasts',
    async (job) => {
      await handler(job.data);
    },
    {
      connection: buildConnection(),
      concurrency: Number(process.env.BULLMQ_WORKER_CONCURRENCY || 10),
    }
  ).on('failed', (job, err) => {
    console.error(`[BroadcastsWorker] Job ${job?.id} failed:`, err.message);
  });

  g.__broadcastsWorkerStarted = true;
  console.log('[BroadcastsWorker] Worker initialized');
}

