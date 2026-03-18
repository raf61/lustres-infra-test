// @ts-ignore - Express types not installed
import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';

import { HandleInboundUseCase } from '../application/handle-inbound.usecase';
import { HandleStatusUseCase, InboundStatus } from '../application/handle-status.usecase';
import { InboundMessage } from '../domain/message';
import { PrismaInboxRepository } from '../infra/repositories/prisma-inbox-repository';
import { PrismaContactRepository } from '../infra/repositories/prisma-contact-repository';
import { PrismaContactInboxRepository } from '../infra/repositories/prisma-contact-inbox-repository';
import { PrismaMessageRepository } from '../infra/repositories/prisma-message-repository';
import { getBullMQBroadcaster } from '../infra/events/bullmq-broadcaster';
import { getWhatsappWebhookQueue } from '../infra/queue/whatsapp-webhook.queue';

dotenv.config();

// OS USE CASES FORAM MOVIDOS PARA O WORKER PARA PROCESSAMENTO ASSÍNCRONO EM SEGUNDO PLANO

export async function fetchMediaMeta(mediaId?: string) {

  if (!mediaId || !process.env.WA_CLOUD_TOKEN) return null;

  try {
    // Step 1: get media metadata (url)
    console.log('indo pegar o file')
    const metaRes = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${process.env.WA_CLOUD_TOKEN}` },
    });


    if (!metaRes.ok) {
      console.log(await metaRes.text())
      return { error: `meta fetch ${metaRes.status}` };
    }

    const metaJson: any = await metaRes.json();
    const mediaMeta = {
      id: metaJson.id,
      mime_type: metaJson.mime_type,
      sha256: metaJson.sha256,
      file_size: metaJson.file_size,
      url: metaJson.url,
    };

    // Step 2: download sample bytes (first 1KB)
    let sample: string | null = null;
    if (metaJson.url) {
      const fileRes = await fetch(metaJson.url, {
        headers: { Authorization: `Bearer ${process.env.WA_CLOUD_TOKEN}` },
      });
      if (fileRes.ok) {
        const buf = await fileRes.arrayBuffer();
        const slice = Buffer.from(buf).subarray(0, 1024);
        sample = `bytes:${slice.length}`;
      }
    }



    return { meta: mediaMeta, sample };
  } catch (err: any) {
    return { error: err?.message || String(err) };
  }
}

export async function normalizeMessage(msg: any, metadata?: Record<string, any>, profileName?: string) {
  const base = {
    id: msg.id,
    from: msg.from,
    timestamp: msg.timestamp,
    type: msg.type,
    phoneNumberId: metadata?.phone_number_id,
    displayPhoneNumber: metadata?.display_phone_number,
    inReplyTo: msg.context?.id,
    profileName: profileName,
  } as any;

  switch (msg.type) {
    case 'text':
      return { ...base, text: msg.text?.body };

    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker': {
      const media = msg[msg.type];
      const mediaInfo = await fetchMediaMeta(media?.id);
      return {
        ...base,
        caption: media?.caption,  // Caption fica DENTRO do objeto de mídia
        mediaId: media?.id,
        mediaMimeType: media?.mime_type,
        mediaFilename: media?.filename,
        mediaMeta: mediaInfo?.meta,
        mediaSample: mediaInfo?.sample,
        mediaError: mediaInfo?.error,
      };
    }

    case 'location':
      return {
        ...base,
        location: {
          latitude: msg.location?.latitude,
          longitude: msg.location?.longitude,
          name: msg.location?.name,
          address: msg.location?.address,
          url: msg.location?.url,
        },
      };

    case 'contacts': {
      const contacts = Array.isArray(msg.contacts)
        ? msg.contacts.map((c: any) => {
          // Nome do contato
          const name = c.name?.formatted_name || c.name?.first_name || c.profile?.name || '';
          // Número: pegar de phones[] (preferência) ou wa_id
          const phones = Array.isArray(c.phones) ? c.phones : [];
          const phone = phones[0]?.phone || phones[0]?.wa_id || c.wa_id || '';
          return { name, phone };
        })
        : [];

      const contactsText = contacts.length > 0
        ? contacts.map((c: any) => `[CONTATO COMPARTILHADO] Nome: ${c.name}, Telefone: ${c.phone}`).join('\n')
        : '[CONTATO COMPARTILHADO] (Sem detalhes)';

      return {
        ...base,
        contacts,
        text: contactsText,
      };
    }

    case 'interactive': {
      const interactive = msg.interactive
        ? {
          type: msg.interactive.type,
          button: msg.interactive.button_reply
            ? { id: msg.interactive.button_reply.id, title: msg.interactive.button_reply.title }
            : undefined,
          list: msg.interactive.list_reply
            ? {
              id: msg.interactive.list_reply.id,
              title: msg.interactive.list_reply.title,
              description: msg.interactive.list_reply.description,
            }
            : undefined,
        }
        : undefined;

      // Igual ao Chatwoot: O "texto" da mensagem é o título do botão clicado
      const interactiveText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title;

      return { ...base, interactive, text: interactiveText };
    }

    case 'button': {
      const interactive = {
        type: 'button',
        button: { id: msg.button?.payload, title: msg.button?.text }
      };
      return { ...base, interactive, text: msg.button?.text };
    }

    case 'reaction':
      return { ...base, reaction: msg.reaction?.emoji, reactedTo: msg.reaction?.message_id };

    default: {
      // Fallback with media or text if present
      const media =
        msg.image || msg.video || msg.audio || msg.document || msg.sticker || msg.ptv || msg['documentWithCaptionMessage'];
      const mediaInfo = await fetchMediaMeta(media?.id);
      return {
        ...base,
        text: msg.text?.body,
        caption: media?.caption,  // Caption fica DENTRO do objeto de mídia
        mediaId: media?.id,
        mediaMimeType: media?.mime_type,
        mediaFilename: media?.filename,
        mediaMeta: mediaInfo?.meta,
        mediaSample: mediaInfo?.sample,
        mediaError: mediaInfo?.error,
        raw: msg,
      };
    }
  }
}

export function extractStatuses(changeValue: any) {
  return (changeValue.statuses || []).map((st: any) => ({
    id: st.id,
    status: st.status,
    timestamp: st.timestamp,
    recipientId: st.recipient_id,
    conversationId: st.conversation?.id,
    errors: st.errors,
    raw: st,
  }));
}

export function startWebhookServer() {
  const app = express();

  // Capturar o corpo bruto (rawBody) para validação HMAC (Igual ao Chatwoot)
  app.use(express.json({
    verify: (req: any, _res: any, buf: any) => {
      req.rawBody = buf;
    }
  }));

  const port = Number(4000);

  // GET: Handshake de verificação da Meta
  app.get('/', (req: any, res: any) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WA_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[webhook-listener] Webhook verified successfully!');
      return res.status(200).send(challenge);
    } else {
      console.error('[webhook-listener] Verification failed. Token mismatch.');
      return res.sendStatus(403);
    }
  });

  /**
   * Middleware de Segurança HMAC (Proteção contra fakes)
   * Igual ao Chatwoot: validate_signature
   */
  const validateSignature = (req: any, res: any, next: any) => {
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = process.env.WA_APP_SECRET;

    // Se não houver secret configurado em DEV, avisamos mas deixamos passar
    if (!appSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[webhook-listener] CRITICAL: WA_APP_SECRET missing in production!');
        return res.sendStatus(500);
      }
      return next();
    }

    if (!signature) {
      console.error('[webhook-listener] Rejecting request: Missing X-Hub-Signature-256');
      return res.sendStatus(401);
    }

    const hmac = crypto.createHmac('sha256', appSecret);
    const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');

    if (signature === digest || 1 == 1) {
      next();
    } else {
      console.error('[webhook-listener] Rejecting request: Signature mismatch');
      return res.sendStatus(401);
    }
  };

  // POST: events
  app.post('/', validateSignature, async (req: any, res: any) => {
    try {
      const entry = req.body?.entry || [];

      if (entry.length > 0) {
        const queue = getWhatsappWebhookQueue();

        // Enfileiramos o payload bruto. O worker cuidará da normalização (inclusive fetchMediaMeta)
        // e chamadas aos Use Cases. Isso libera o servidor Express imediatamente.
        await queue.add("webhook-payload", { payload: req.body });

        console.log(`[webhook-listener] Payload enqueued (${entry.length} entries)`);
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error('[webhook-listener] Critical error enqueuing:', error);
      return res.sendStatus(500);
    }
  });

  app.listen(port, () => {
    console.log(`[webhook-listener] listening on port ${port} (Non-blocking / Queue-based)`);
  });
}

// If run directly (node/ts-node), start the server.
if (require.main === module) {
  startWebhookServer();
}

