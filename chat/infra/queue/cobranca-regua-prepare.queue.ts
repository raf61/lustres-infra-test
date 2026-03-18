import { Queue, Worker, ConnectionOptions } from "bullmq"

export type CobrancaReguaPrepareJob = {
  ruleKey: string
  inboxId: string
  assigneeId?: string | null
  debitoIds: number[]
  template: {
    name: string
    languageCode: string
    components: any[]
  }
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
  info: (...args: unknown[]) => console.info("[CobrancaReguaPrepareQueue]", ...args),
  error: (...args: unknown[]) => console.error("[CobrancaReguaPrepareQueue]", ...args),
}

type Globals = typeof globalThis & {
  __cobrancaReguaPrepareQueue?: Queue<CobrancaReguaPrepareJob>
  __cobrancaReguaPrepareWorkerStarted?: boolean
}

const g = globalThis as Globals

export function getCobrancaReguaPrepareQueue(): Queue<CobrancaReguaPrepareJob> {
  if (g.__cobrancaReguaPrepareQueue) return g.__cobrancaReguaPrepareQueue

  g.__cobrancaReguaPrepareQueue = new Queue<CobrancaReguaPrepareJob>("cobranca-regua-prepare", {
    connection: buildConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  })

  return g.__cobrancaReguaPrepareQueue
}

export function ensureCobrancaReguaPrepareWorker(
  handler: (data: CobrancaReguaPrepareJob) => Promise<void>,
) {
  if (g.__cobrancaReguaPrepareWorkerStarted) return

  const concurrency = Number(process.env.BULLMQ_COBRANCA_PREPARE_CONCURRENCY || 1)

  new Worker<CobrancaReguaPrepareJob>(
    "cobranca-regua-prepare",
    async (job) => {
      logger.info({ jobId: job.id, ruleKey: job.data.ruleKey }, "processing cobranca-regua-prepare")
      await handler(job.data)
    },
    {
      connection: buildConnection(),
      concurrency,
    },
  ).on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "cobranca-regua-prepare failed")
  })

  g.__cobrancaReguaPrepareWorkerStarted = true
  logger.info(`Worker started with concurrency ${concurrency}`)
}

