import { Queue, Worker, ConnectionOptions } from 'bullmq';

export type DownloadMediaJob = {
  attachmentId: string;
  mediaId: string;
  messageId: string;
};

function buildConnection(): ConnectionOptions {
  const host = process.env.BULLMQ_REDIS_HOST;
  const port = Number(process.env.BULLMQ_REDIS_PORT);
  const username = process.env.BULLMQ_REDIS_USERNAME;
  const password = process.env.BULLMQ_REDIS_PASSWORD;

  return {
    host,
    port,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  };
}

const logger = {
  info: (...args: unknown[]) => console.info('[DownloadMediaQueue]', ...args),
  error: (...args: unknown[]) => console.error('[DownloadMediaQueue]', ...args),
};

type Globals = typeof globalThis & {
  __downloadMediaQueue?: Queue<DownloadMediaJob>;
  __downloadMediaWorkerStarted?: boolean;
};

const g = globalThis as Globals;

export function getDownloadMediaQueue(): Queue<DownloadMediaJob> {
  if (g.__downloadMediaQueue) return g.__downloadMediaQueue;

  g.__downloadMediaQueue = new Queue<DownloadMediaJob>('chat-download-media', {
    connection: buildConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  });

  return g.__downloadMediaQueue;
}

export function ensureDownloadMediaWorker(handler: (data: DownloadMediaJob) => Promise<void>) {
  if (g.__downloadMediaWorkerStarted) return;

  const concurrency = Number(process.env.BULLMQ_WORKER_CONCURRENCY || 1);

  new Worker<DownloadMediaJob>(
    'chat-download-media',
    async (job) => {
      logger.info({ jobId: job.id, attachmentId: job.data.attachmentId }, 'processing download-media');
      await handler(job.data);
    },
    {
      connection: buildConnection(),
      concurrency,
    },
  ).on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'download-media failed');
  });

  g.__downloadMediaWorkerStarted = true;
}

