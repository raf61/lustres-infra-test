import { Queue, ConnectionOptions } from "bullmq";

export const FOLLOW_UP_QUEUE_NAME = "follow-up-queue";

function buildConnection(): ConnectionOptions {
    return {
        host: process.env.BULLMQ_REDIS_HOST || "localhost",
        port: Number(process.env.BULLMQ_REDIS_PORT) || 6379,
        username: process.env.BULLMQ_REDIS_USERNAME,
        password: process.env.BULLMQ_REDIS_PASSWORD,
    };
}

let followUpQueue: Queue | null = null;

export function getFollowUpQueue() {
    if (!followUpQueue) {
        followUpQueue = new Queue(FOLLOW_UP_QUEUE_NAME, {
            connection: buildConnection(),
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        });
    }
    return followUpQueue;
}
