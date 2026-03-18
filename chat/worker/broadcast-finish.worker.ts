import { ensureBroadcastFinishWorker } from "../infra/queue/broadcast-finish.queue";
import { prisma } from "../../lib/prisma";

ensureBroadcastFinishWorker(async (jobData) => {
  await prisma.chatBroadcast.update({
    where: { id: jobData.broadcastId },
    data: { status: "COMPLETED" },
  });
});

console.log("[broadcast-finish.worker] Worker initialized");
