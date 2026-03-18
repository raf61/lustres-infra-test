import { ensureSendMessageWorker } from '../infra/queue/send-message.queue';
import { ProcessSendMessageUseCase } from '../application/process-send-message.usecase';
import { PrismaMessageRepository } from '../infra/repositories/prisma-message-repository';
import { getBullMQBroadcaster } from '../infra/events/bullmq-broadcaster';

// Instanciar dependências
const messageRepository = new PrismaMessageRepository();
const broadcaster = getBullMQBroadcaster();

// Instanciar use case
const processSendMessage = new ProcessSendMessageUseCase(messageRepository, broadcaster);

// Iniciar worker
ensureSendMessageWorker(async (jobData) => {
  await processSendMessage.execute(jobData);
});

console.log('[send-message.worker] Worker initialized');
