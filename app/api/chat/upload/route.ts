import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { UploadChatAttachmentUseCase } from "../../../../chat/application/upload-attachment.usecase";

export const dynamic = "force-dynamic";

const uploadUseCase = new UploadChatAttachmentUseCase();

/**
 * POST /api/chat/upload
 * Upload de arquivos para o chat (imagens, vídeos, áudios, documentos)
 * Retorna URL HTTP pública pronta para uso
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const conversationId = formData.get("conversationId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Executar UseCase
    const result = await uploadUseCase.execute({
      file: buffer,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      conversationId: conversationId || undefined,
    });

    return NextResponse.json({
      success: true,
      attachment: {
        url: result.url,
        fileName: result.fileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      },
    });
  } catch (error) {
    console.error("[POST /api/chat/upload] Error:", error);
    
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.includes("too large") ? 400 : 500;
    
    return NextResponse.json({ error: message }, { status });
  }
}
