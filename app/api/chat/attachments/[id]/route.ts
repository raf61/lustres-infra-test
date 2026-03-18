import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/attachments/:id
 * 
 * Retorna URL assinada para download do attachment.
 * A URL é válida por 1 hora por padrão.
 * 
 * Query params:
 * - expiresIn: tempo de validade em segundos (default: 3600)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10);

    // Buscar attachment
    const attachment = await prisma.chatAttachment.findUnique({
      where: { id },
      select: {
        id: true,
        fileUrl: true,
        externalUrl: true,
        fileName: true,
        fileType: true,
        mimeType: true,
        fileSize: true,
        downloadStatus: true,
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Se o download ainda não completou, retorna status
    if (attachment.downloadStatus === 'pending' || attachment.downloadStatus === 'downloading') {
      return NextResponse.json({
        id: attachment.id,
        status: attachment.downloadStatus,
        url: null,
        message: 'Attachment is being downloaded',
      });
    }

    if (attachment.downloadStatus === 'failed') {
      return NextResponse.json({
        id: attachment.id,
        status: 'failed',
        url: null,
        message: 'Attachment download failed',
      });
    }

    // Gerar URL assinada
    let signedUrl: string | null = null;

    if (attachment.fileUrl) {
      // Arquivo está no nosso storage (privado) - gerar URL assinada
      signedUrl = await storage.getDownloadUrlFromStoredUrl(attachment.fileUrl, expiresIn);
    } else if (attachment.externalUrl) {
      // Fallback para URL externa (pode estar expirada)
      signedUrl = attachment.externalUrl;
    }

    return NextResponse.json({
      id: attachment.id,
      status: 'completed',
      url: signedUrl,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
    });

  } catch (error: any) {
    console.error('[GET /api/chat/attachments/:id] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

