import { ensureDownloadMediaWorker } from '../infra/queue/download-media.queue';
import { DownloadMediaUseCase } from '../application/download-media.usecase';
import { getBullMQBroadcaster } from '../infra/events/bullmq-broadcaster';

const broadcaster = getBullMQBroadcaster();
const downloadMediaUseCase = new DownloadMediaUseCase(broadcaster);

ensureDownloadMediaWorker(async (job) => {
  await downloadMediaUseCase.execute(job);
});

console.log('[DownloadMediaWorker] Worker started');

