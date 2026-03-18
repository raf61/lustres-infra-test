import { prisma } from '../../lib/prisma';
import { DownloadMediaJob } from '../infra/queue/download-media.queue';
import { downloadAndUploadMedia } from '../infra/provider/download-media.provider';
import { IBroadcaster } from '../domain/events/broadcaster';

export class DownloadMediaUseCase {
  constructor(private readonly broadcaster?: IBroadcaster) {}

  async execute(job: DownloadMediaJob): Promise<void> {
    const { attachmentId } = job;

    try {
      // 1. Atualizar status para "downloading"
      await prisma.chatAttachment.update({
        where: { id: attachmentId },
        data: { downloadStatus: 'downloading' },
      });

      // 2. Fazer download e upload (retorna URL base)
      const fileUrl = await downloadAndUploadMedia(job);

      // 3. Atualizar com a URL
      const attachment = await prisma.chatAttachment.update({
        where: { id: attachmentId },
        data: {
          fileUrl,
          downloadStatus: 'completed',
        },
        include: {
          message: {
            select: {
              id: true,
              conversationId: true,
              conversation: { select: { inboxId: true } },
            },
          },
        },
      });

      console.log(`[DownloadMediaUseCase] Attachment ${attachmentId} downloaded successfully`);

      // 4. Broadcast para atualizar frontend
      if (this.broadcaster && attachment.message) {
        await this.broadcaster.broadcast({
          type: 'message.updated',
          payload: {
            id: attachment.message.id,
            conversationId: attachment.message.conversationId,
            inboxId: attachment.message.conversation?.inboxId,
            attachment: {
              id: attachment.id,
              downloadStatus: 'completed',
            },
          },
        });
      }
    } catch (error) {
      console.error(`[DownloadMediaUseCase] Failed to download attachment ${attachmentId}:`, error);

      // Marcar como falha e notificar
      const attachment = await prisma.chatAttachment.update({
        where: { id: attachmentId },
        data: { downloadStatus: 'failed' },
        include: {
          message: {
            select: {
              id: true,
              conversationId: true,
              conversation: { select: { inboxId: true } },
            },
          },
        },
      });

      if (this.broadcaster && attachment.message) {
        await this.broadcaster.broadcast({
          type: 'message.updated',
          payload: {
            id: attachment.message.id,
            conversationId: attachment.message.conversationId,
            inboxId: attachment.message.conversation?.inboxId,
            attachment: {
              id: attachment.id,
              downloadStatus: 'failed',
            },
          },
        });
      }

      throw error;
    }
  }
}

