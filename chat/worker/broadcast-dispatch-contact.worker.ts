import { ensureBroadcastDispatchContactWorker } from "../infra/queue/broadcast-dispatch-contact.queue";
import { ProcessBroadcastDispatchContactUseCase } from "../application/broadcast/process-broadcast-dispatch-contact.usecase";
import { prisma } from "../../lib/prisma";

const processBroadcastDispatchContact = new ProcessBroadcastDispatchContactUseCase(prisma);

ensureBroadcastDispatchContactWorker(async (jobData) => {
  await processBroadcastDispatchContact.execute(jobData);
});

console.log("[broadcast-dispatch-contact.worker] Worker initialized");
