import { Queue, Worker, ConnectionOptions } from "bullmq"

export type CobrancaReguaSendJob = {
  envioId: number
  messageId: string
}

function buildConnection(): ConnectionOptions {
  const host = process.env.BULLMQ_REDIS_HOST
  const port = Number(process.env.BULLMQ_REDIS_PORT)
  const username = process.env.BULLMQ_REDIS_USERNAME
  const password = process.env.BULLMQ_REDIS_PASSWORD

  if (!host || !port) {
    throw new Error("Missing BULLMQ_REDIS_HOST or BULLMQ_REDIS_PORT")
  }

  return {
    host,
    port,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  }
}

const logger = {
  info: (...args: unknown[]) => console.info("[CobrancaReguaSendQueue]", ...args),
  error: (...args: unknown[]) => console.error("[CobrancaReguaSendQueue]", ...args),
}

type Globals = typeof globalThis & {
  __cobrancaReguaSendQueue?: Queue<CobrancaReguaSendJob>
  __cobrancaReguaSendWorkerStarted?: boolean
}

const g = globalThis as Globals

export function getCobrancaReguaSendQueue(): Queue<CobrancaReguaSendJob> {
  if (g.__cobrancaReguaSendQueue) return g.__cobrancaReguaSendQueue

  g.__cobrancaReguaSendQueue = new Queue<CobrancaReguaSendJob>("cobranca-regua-send", {
    connection: buildConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  })

  return g.__cobrancaReguaSendQueue
}

export function ensureCobrancaReguaSendWorker(
  handler: (data: CobrancaReguaSendJob) => Promise<void>,
) {
  if (g.__cobrancaReguaSendWorkerStarted) return

  const concurrency = Number(process.env.BULLMQ_COBRANCA_SEND_CONCURRENCY || 1)

  new Worker<CobrancaReguaSendJob>(
    "cobranca-regua-send",
    async (job) => {
      logger.info({ jobId: job.id, messageId: job.data.messageId }, "processing cobranca-regua-send")
      await handler(job.data)
    },
    {
      connection: buildConnection(),
      concurrency,
      limiter: { max: 1, duration: 100 },
    },
  ).on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "cobranca-regua-send failed")
  })

  g.__cobrancaReguaSendWorkerStarted = true
  logger.info(`Worker started with concurrency ${concurrency}`)
}

