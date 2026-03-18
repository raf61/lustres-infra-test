import { ensureCobrancaReguaSendWorker } from "../infra/queue/cobranca-regua-send.queue"
import { PrismaMessageRepository } from "../infra/repositories/prisma-message-repository"
import { getBullMQBroadcaster } from "../infra/events/bullmq-broadcaster"
import { ProcessSendMessageUseCase } from "../application/process-send-message.usecase"
import { prisma } from "../../lib/prisma"

const messageRepository = new PrismaMessageRepository()
const broadcaster = getBullMQBroadcaster()
const processSendMessage = new ProcessSendMessageUseCase(messageRepository, broadcaster)

ensureCobrancaReguaSendWorker(async (jobData) => {
  try {
    await processSendMessage.execute({ messageId: jobData.messageId })
    await prisma.cobrancaCampanhaEnvio.update({
      where: { id: jobData.envioId },
      data: { status: "SENT", error: null },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar mensagem"
    await prisma.cobrancaCampanhaEnvio.update({
      where: { id: jobData.envioId },
      data: { status: "FAILED", error: message },
    })
    throw error
  }
})

console.log("[cobranca-regua-send.worker] Worker initialized")

