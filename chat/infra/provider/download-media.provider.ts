import { storage } from '../../../lib/storage';
import { DownloadMediaJob } from '../queue/download-media.queue';

type WhatsAppCloudConfig = {
  token: string;
  apiVersion: string;
};

const getWhatsAppCloudConfig = (): WhatsAppCloudConfig => {
  const token = process.env.WA_CLOUD_TOKEN;
  const apiVersion = process.env.WA_CLOUD_API_VERSION;

  if (!token || !apiVersion) {
    throw new Error('Missing WhatsApp Cloud API environment variables (WA_CLOUD_TOKEN, WA_CLOUD_API_VERSION)');
  }

  return { token, apiVersion };
};

// Limite de tamanho: 100MB (igual ao WhatsApp)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function downloadAndUploadMedia(job: DownloadMediaJob): Promise<string> {
  const { mediaId } = job;
  const { token, apiVersion } = getWhatsAppCloudConfig();

  // 1. Buscar metadados do arquivo na Meta
  console.log(`[DownloadMedia] Fetching metadata for ${mediaId}...`);
  const metaRes = await fetch(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaRes.ok) {
    throw new Error(`Failed to fetch media metadata: ${metaRes.status} ${await metaRes.text()}`);
  }

  const metadata: any = await metaRes.json();
  const fileUrl = metadata.url;
  const mimeType = metadata.mime_type;
  const fileSize = metadata.file_size;

  if (!fileUrl) {
    throw new Error('Media URL not found in metadata');
  }

  // 2. Validar tamanho (se disponível nos metadados)
  if (fileSize && fileSize > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande: ${fileSize} bytes (máx: ${MAX_FILE_SIZE})`);
  }

  // 3. Baixar o arquivo da Meta
  console.log(`[DownloadMedia] Downloading file from Meta...`);
  const fileRes = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!fileRes.ok) {
    throw new Error(`Failed to download media file: ${fileRes.status}`);
  }

  const baseMimeType = mimeType.split(';')[0].trim();
  let finalBuffer = Buffer.from(await fileRes.arrayBuffer());
  let finalMimeType = mimeType;
  let finalExtension = baseMimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';

  // Otimização de Imagem
  if (baseMimeType.startsWith('image/')) {
    try {
      const sharp = (await import("sharp")).default;
      const optimized = await sharp(finalBuffer)
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      finalBuffer = optimized as any;
      finalMimeType = "image/webp";
      finalExtension = "webp";
    } catch (error) {
      console.error("[DownloadMedia] Error optimizing image:", error);
    }
  }

  // 5. Gerar nome único
  const key = `chat/attachments/${Date.now()}-${mediaId}.${finalExtension}`;

  // 6. Upload para o Storage (S3/Spaces)
  console.log(`[DownloadMedia] Uploading to storage (private) as ${key}...`);
  const result = await storage.uploadPrivateObject({
    key,
    contentType: finalMimeType,
    body: finalBuffer as any,
  });

  console.log(`[DownloadMedia] Upload complete (private): ${result.url}`);

  // Retorna a URL base (usar parseKeyFromUrl + getPrivateObjectUrl para acessar)
  return result.url;
}

