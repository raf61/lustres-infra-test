import { ensureBroadcastPrepareWorker } from "../infra/queue/broadcast-prepare.queue";
import { ProcessBroadcastDispatchUseCase } from "../application/broadcast/process-broadcast-dispatch.usecase";
import { prisma } from "../../lib/prisma";

const processBroadcastDispatch = new ProcessBroadcastDispatchUseCase(prisma);

ensureBroadcastPrepareWorker(async (jobData) => {
  await processBroadcastDispatch.execute(jobData);
});

console.log("[broadcast-prepare.worker] Worker initialized");

