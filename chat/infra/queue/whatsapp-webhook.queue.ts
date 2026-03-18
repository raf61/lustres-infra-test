import { Queue, Worker, ConnectionOptions } from "bullmq";

export type WhatsappWebhookJob = {
    payload: any;
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
    info: (...args: unknown[]) => console.info("[WhatsappWebhookQueue]", ...args),
    error: (...args: unknown[]) => console.error("[WhatsappWebhookQueue]", ...args),
};

type Globals = typeof globalThis & {
    __whatsappWebhookQueue?: Queue<WhatsappWebhookJob>;
    __whatsappWebhookWorkerStarted?: boolean;
};

const g = globalThis as Globals;

export function getWhatsappWebhookQueue(): Queue<WhatsappWebhookJob> {
    if (g.__whatsappWebhookQueue) return g.__whatsappWebhookQueue;

    g.__whatsappWebhookQueue = new Queue<WhatsappWebhookJob>("whatsapp-webhook-ingestion", {
        connection: buildConnection(),
        defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 1000,
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 1000,
            },
        },
    });

    return g.__whatsappWebhookQueue;
}

export function ensureWhatsappWebhookWorker(handler: (data: WhatsappWebhookJob) => Promise<void>) {
    if (g.__whatsappWebhookWorkerStarted) return;

    const concurrency = Number(process.env.WEBHOOK_PROCESSOR_CONCURRENCY || 5);

    new Worker<WhatsappWebhookJob>(
        "whatsapp-webhook-ingestion",
        async (job) => {
            await handler(job.data);
        },
        {
            connection: buildConnection(),
            concurrency,
        },
    ).on("failed", (job, err) => {
        logger.error({ jobId: job?.id, err: err.message }, "Job failed");
    });

    g.__whatsappWebhookWorkerStarted = true;
    logger.info(`Worker started with concurrency ${concurrency}`);
}
