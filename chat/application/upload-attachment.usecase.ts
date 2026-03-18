import { storage } from '../../lib/storage';

// ════════════════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════════════════

export interface UploadAttachmentInput {
  file: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  conversationId?: string;
}

export interface UploadAttachmentResult {
  url: string;      // URL HTTP pública (assinada) - pronta para usar
  fileName: string;
  fileType: string; // image, video, audio, document
  fileSize: number;
  mimeType: string;
}

// ════════════════════════════════════════════════════════════════════════════
// USE CASE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Upload de anexo para envio em mensagens do chat
 * 
 * Responsabilidades:
 * - Validar tamanho do arquivo (16MB para WhatsApp)
 * - Determinar tipo do arquivo
 * - Gerar key única para o S3
 * - Fazer upload para storage privado
 * - Retornar URL HTTP pública assinada (pronta para Meta API)
 */
export class UploadChatAttachmentUseCase {
  private readonly maxSizeBytes = 16 * 1024 * 1024; // 16MB (limite WhatsApp)
  private readonly urlExpiresIn = 7 * 24 * 60 * 60; // 7 dias (máximo do S3)

  async execute(input: UploadAttachmentInput): Promise<UploadAttachmentResult> {
    const { file, fileName, mimeType, fileSize, conversationId } = input;

    // 1. Validar tamanho
    if (fileSize > this.maxSizeBytes) {
      throw new Error(`File too large. Maximum size is 16MB`);
    }

    // 2. Determinar tipo do arquivo
    let fileType = this.getFileType(mimeType);
    let finalBuffer = file;
    let finalMimeType = mimeType;
    let finalFileName = fileName;
    let finalSize = fileSize;

    // Otimização de Imagem
    if (fileType === 'image') {
      try {
        const sharp = (await import("sharp")).default
        const optimized = await sharp(file)
          .resize({ width: 1280, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();

        finalBuffer = optimized;
        finalMimeType = "image/webp";
        finalSize = optimized.length;

        // Ajustar nome do arquivo para .webp
        const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        finalFileName = `${baseName}.webp`;
      } catch (error) {
        console.error("[UploadChatAttachmentUseCase] Error optimizing image:", error);
      }
    }

    // 3. Gerar key única para o S3
    const ext = finalFileName.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const folder = conversationId || 'general';
    const key = `chat/attachments/${folder}/${timestamp}-${randomId}.${ext}`;

    // 4. Upload para S3 (privado)
    await storage.uploadPrivateObject({
      key,
      contentType: finalMimeType,
      body: finalBuffer,
    });

    // 5. Gerar URL HTTP pública assinada (válida por 7 dias)
    const url = await storage.getPrivateObjectUrl(key, this.urlExpiresIn);

    // 6. Retornar URL pronta para uso
    return {
      url,
      fileName: finalFileName,
      fileType,
      fileSize: finalSize,
      mimeType: finalMimeType,
    };
  }

  private getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }
}
