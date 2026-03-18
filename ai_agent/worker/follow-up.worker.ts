import { Worker, ConnectionOptions } from "bullmq";
import { FOLLOW_UP_QUEUE_NAME } from "../infra/queue/follow-up.queue";
import { ProcessFollowUpUseCase } from "../application/process-follow-up.usecase";
import { SendMessageUseCase } from "../../chat/application/send-message.usecase";
import { PrismaMessageRepository } from "../../chat/infra/repositories/prisma-message-repository";
import { PrismaConversationRepository } from "../../chat/infra/repositories/prisma-conversation-repository";
import { ReturnToResearchUseCase } from "../../chat/application/return-to-research.usecase";

const messageRepo = new PrismaMessageRepository();
const conversationRepo = new PrismaConversationRepository();
const sendMessageUseCase = new SendMessageUseCase(messageRepo, conversationRepo);
const returnToResearchUseCase = new ReturnToResearchUseCase(conversationRepo);

const processFollowUpUseCase = new ProcessFollowUpUseCase(
    sendMessageUseCase,
    returnToResearchUseCase
);

function buildConnection(): ConnectionOptions {
    return {
        host: process.env.BULLMQ_REDIS_HOST || "localhost",
        port: Number(process.env.BULLMQ_REDIS_PORT) || 6379,
        username: process.env.BULLMQ_REDIS_USERNAME,
        password: process.env.BULLMQ_REDIS_PASSWORD,
    };
}

let workerStarted = false;

export const ensureFollowUpWorker = () => {
    if (workerStarted) return;
    workerStarted = true;

    const worker = new Worker(
        FOLLOW_UP_QUEUE_NAME,
        async (job) => {
            const { conversationId } = job.data;
            console.log(`[FollowUp Worker] 🟢 Pickup Job: ${job.id} para conversa: ${conversationId}`);
            try {
                await processFollowUpUseCase.execute(conversationId);
            } catch (error) {
                console.error(`[FollowUp Worker] Erro ao processar ${conversationId}:`, error);
                throw error;
            }
        },
        {
            connection: buildConnection(),
            concurrency: 5,
        }
    );

    worker.on("completed", (job) => {
        console.log(`[FollowUp Worker] Job ${job.id} concluído com sucesso.`);
    });

    worker.on("failed", (job, err) => {
        console.error(`[FollowUp Worker] Job ${job?.id} falhou:`, err);
    });

    console.log(`[FollowUp Worker] Monitorando fila: ${FOLLOW_UP_QUEUE_NAME}`);
};
