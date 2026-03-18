import { ensureBroadcastSendWorker } from "../infra/queue/broadcast-send.queue";
import { ProcessSendMessageUseCase } from "../application/process-send-message.usecase";
import { UpdateBroadcastRecipientUseCase } from "../application/broadcast/update-broadcast-recipient.usecase";
import { PrismaMessageRepository } from "../infra/repositories/prisma-message-repository";
import { getBullMQBroadcaster } from "../infra/events/bullmq-broadcaster";
import { prisma } from "../../lib/prisma";

const messageRepository = new PrismaMessageRepository();
const broadcaster = getBullMQBroadcaster();
const processSendMessage = new ProcessSendMessageUseCase(messageRepository, broadcaster);
const updateBroadcastRecipientUseCase = new UpdateBroadcastRecipientUseCase(prisma);
const recipientStatus = {
  sent: "SENT",
  failed: "FAILED",
} as const;

ensureBroadcastSendWorker(async (jobData) => {
  try {
    await processSendMessage.execute(jobData);
    //console.log("jobData fake message(tirar o comentário do envio)", jobData);
    await updateBroadcastRecipientUseCase.execute({
      messageId: jobData.messageId,
      status: recipientStatus.sent,
    });
  } catch (error) {
    await updateBroadcastRecipientUseCase.execute({
      messageId: jobData.messageId,
      status: recipientStatus.failed,
    });
    throw error;
  }
});

console.log("[broadcast-send.worker] Worker initialized");

