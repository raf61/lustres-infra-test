import { MessageRecord } from '../../domain/repositories/message-repository';
import { storage } from '../../../lib/storage';

type WhatsAppSendResult = {
  success: boolean;
  providerMessageId?: string;
  error?: {
    code: number;
    title: string;
    message: string;
  };
};

/**
 * Envia mensagem de texto
 */
async function sendTextMessage(
  message: MessageRecord,
  phoneNumberId: string,
  recipientPhone: string,
  token: string,
  apiVersion: string
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  
  const body: any = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'text',
    text: { body: message.content || '' },
  };

  if (message.contentAttributes?.inReplyToExternalId) {
    body.context = { message_id: message.contentAttributes.inReplyToExternalId };
  }

  return executeRequest(url, token, body);
}

/**
 * Envia mensagem de template (HSM)
 * Igual ao Chatwoot: whatsapp_cloud_service.rb#template_body_parameters
 */
async function sendTemplateMessage(
  message: MessageRecord,
  phoneNumberId: string,
  recipientPhone: string,
  token: string,
  apiVersion: string
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  
  const templateData = message.contentAttributes?.template;
  if (!templateData) {
    throw new Error('Template data missing in message contentAttributes');
  }

  // Deep copy dos componentes para não alterar o objeto original e permitir mutação segura
  const components = JSON.parse(JSON.stringify(templateData.components || []));

  // Escanear componentes em busca de mídias do S3 para assinar as URLs
  for (const component of components) {
    if (component.parameters && Array.isArray(component.parameters)) {
      for (const param of component.parameters) {
        const mediaType = param.type; 
        if (['image', 'video', 'document', 'audio'].includes(mediaType)) {
          const mediaObj = param[mediaType];
          if (mediaObj && mediaObj.link) {
            mediaObj.link = await storage.getDownloadUrlFromStoredUrl(mediaObj.link);
            console.log(`[WhatsAppCloudProvider] Processed ${mediaType} URL in template`);
          }
        }
      }
    }
  }

  const body: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'template',
    template: {
      name: templateData.name,
      language: {
        policy: 'deterministic',
        code: templateData.languageCode,
      },
      components: components,
    },
  };

  // Debug log para ver o JSON do template (com as URLs assinadas agora)
  console.log(`[WhatsAppCloudProvider] Sending Template to Meta:`, JSON.stringify(body, null, 2));

  return executeRequest(url, token, body);
}

/**
 * Helper para executar o POST na API da Meta
 */
async function executeRequest(url: string, token: string, body: any): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseData = (await response.json()) as any;

    if (response.ok && responseData.messages?.[0]?.id) {
      return {
        success: true,
        providerMessageId: responseData.messages[0].id,
      };
    } else {
      const error = responseData.error || {};
      console.error('[WhatsAppCloudProvider] Send failed', {
        status: response.status,
        code: error.code || response.status,
        title: error.title || 'Unknown error',
        message: error.message || JSON.stringify(responseData),
      });
      return {
        success: false,
        error: {
          code: error.code || response.status,
          title: error.title || 'Unknown error',
          message: error.message || JSON.stringify(responseData),
        },
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 0,
        title: 'Network error',
        message: err.message || String(err),
      },
    };
  }
}

/**
 * Envia mensagem de mídia (Imagem, Áudio, Vídeo, Documento)
 * Igual ao Chatwoot: whatsapp_cloud_service.rb#send_attachment_message
 */
async function sendMediaMessage(
  message: MessageRecord,
  phoneNumberId: string,
  recipientPhone: string,
  token: string,
  apiVersion: string
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  
  const attachment = message.attachments?.[0];
  if (!attachment) {
    throw new Error('No attachment found in message');
  }

  // Mapeamento de tipos igual ao Chatwoot (whatsapp_cloud_service.rb:121)
  // Se não for imagem, áudio ou vídeo, a Meta exige que seja 'document'
  const type = ['image', 'audio', 'video'].includes(attachment.fileType) 
    ? attachment.fileType 
    : 'document';

  // Resolvendo a URL através do storage (Desacoplado)
  const mediaUrl = await storage.getDownloadUrlFromStoredUrl(attachment.fileUrl || attachment.externalUrl);
  
  if (!mediaUrl) {
    throw new Error('Attachment missing fileUrl/externalUrl');
  }

  const typeContent: any = {
    link: mediaUrl,
  };

  // Chatwoot (whatsapp_cloud_service.rb:125): Legenda não é permitida em áudios
  if (type !== 'audio' && message.content) {
    typeContent.caption = message.content;
  }

  // Chatwoot (whatsapp_cloud_service.rb:126): Nome do arquivo apenas para documentos
  if (type === 'document' && attachment.fileName) {
    typeContent.filename = attachment.fileName;
  }

  const body: any = {
    messaging_product: 'whatsapp',
    // Removido recipient_type para ficar 100% igual ao Chatwoot em mídias
    to: recipientPhone,
    type: type,
    [type]: typeContent,
  };

  if (message.contentAttributes?.inReplyToExternalId) {
    body.context = { message_id: message.contentAttributes.inReplyToExternalId };
  }

  console.log(`[WhatsAppCloudProvider] Sending Media to Meta:`, JSON.stringify(body, null, 2));

  return executeRequest(url, token, body);
}

/**
 * Processa envio de mensagem (Direciona para o tipo correto)
 */
export async function sendMessage(message: MessageRecord): Promise<WhatsAppSendResult> {
  if (!message.conversation) {
    throw new Error('Message must include conversation with inbox');
  }

  const { sourceId, inbox } = message.conversation;
  const token = inbox.settings?.whatsapp_cloud?.token || process.env.WA_CLOUD_TOKEN;
  const apiVersion = inbox.settings?.whatsapp_cloud?.apiVersion || process.env.WA_CLOUD_API_VERSION;

  if (!token || !apiVersion) {
    throw new Error('Missing WhatsApp Cloud config');
  }

  if (!sourceId) {
    throw new Error('Missing sourceId (recipient phone number)');
  }

  // 1. Template
  if (message.messageType === 'template') {
    return sendTemplateMessage(message, inbox.phoneNumberId, sourceId, token, apiVersion);
  }

  // 2. Mídia (Se tiver anexos)
  if (message.attachments && message.attachments.length > 0) {
    return sendMediaMessage(message, inbox.phoneNumberId, sourceId, token, apiVersion);
  }

  // 3. Interativa (Botões/Listas - Padrão Chatwoot)
  if (message.contentType === 'input_select') {
    return sendInteractiveMessage(message, inbox.phoneNumberId, sourceId, token, apiVersion);
  }

  // 4. Texto normal (session message)
  return sendTextMessage(message, inbox.phoneNumberId, sourceId, token, apiVersion);
}

/**
 * Envia mensagem interativa (Botões ou Listas)
 * Igual ao Chatwoot: base_service.rb#create_payload_based_on_items
 */
async function sendInteractiveMessage(
  message: MessageRecord,
  phoneNumberId: string,
  recipientPhone: string,
  token: string,
  apiVersion: string
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const items = message.contentAttributes?.items || [];

  if (items.length === 0) {
    throw new Error('Interactive message requires at least one item in contentAttributes.items');
  }

  let interactivePayload: any;

  if (items.length <= 3) {
    // 1. Reply Buttons (Máximo 3)
    interactivePayload = {
      type: 'button',
      body: { text: message.content || '' },
      action: {
        buttons: items.map((item: any) => ({
          type: 'reply',
          reply: {
            id: String(item.value),
            title: String(item.title).substring(0, 20), // Limite da Meta: 20 chars
          },
        })),
      },
    };
  } else {
    // 2. List Message (Máximo 10)
    interactivePayload = {
      type: 'list',
      body: { text: message.content || '' },
      action: {
        button: 'Opções', // Texto do botão que abre a lista
        sections: [
          {
            title: 'Escolha uma opção',
            rows: items.slice(0, 10).map((item: any) => ({
              id: String(item.value),
              title: String(item.title).substring(0, 24), // Limite da Meta: 24 chars
              description: item.description ? String(item.description).substring(0, 72) : undefined,
            })),
          },
        ],
      },
    };
  }

  const body = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'interactive',
    interactive: interactivePayload,
  };

  console.log(`[WhatsAppCloudProvider] Sending Interactive (${interactivePayload.type}) to Meta:`, JSON.stringify(body, null, 2));

  return executeRequest(url, token, body);
}
