/**
 * =============================================================================
 * MÓDULO DE ASSINATURAS DE DOCUMENTOS OPERACIONAIS
 * =============================================================================
 * 
 * Gerencia o ciclo de vida das assinaturas da tabela DocumentoOperacionalAssinatura.
 * 
 * CONTEXTO:
 * - Documentos Operacionais: Termo de Conclusão, Relatório de Vistoria, etc.
 * - Assinaturas: Capturadas na tela do técnico via canvas (funcionário e condomínio)
 * - Armazenamento: Campo `url` da tabela DocumentoOperacionalAssinatura
 * 
 * FLUXO:
 * 1. UPLOAD: Assinatura capturada (data URL do canvas) → enviada ao S3 (private)
 * 2. STORAGE: URL do S3 armazenada em DocumentoOperacionalAssinatura.url
 * 3. RESOLUÇÃO: Na geração de PDF, URL convertida de volta para data URL
 * 
 * COMPATIBILIDADE COM DADOS LEGADOS:
 * - Assinaturas antigas: salvas como data URL direto no banco → funcionam normalmente
 * - Assinaturas novas: salvas como URL do S3 → baixadas e convertidas quando necessário
 * 
 * =============================================================================
 */

import { storage } from "@/lib/storage"

// =============================================================================
// TIPOS
// =============================================================================

/** 
 * Entrada para upload de assinatura de documento operacional
 * Usado quando o técnico coleta assinatura na tela
 */
type DocOperacionalAssinaturaUploadInput = {
  /** ID do DocumentoOperacional (FK) */
  documentoOperacionalId: number
  /** Role do assinante: funcionario_tecnico, funcionario_condominio */
  role: "funcionario_tecnico" | "funcionario_condominio" | string
  /** Assinatura em formato data URL (base64) vinda do canvas */
  dataUrl: string
}

/** 
 * Resultado do upload - usado para salvar em DocumentoOperacionalAssinatura.url
 */
type DocOperacionalAssinaturaUploadResult = {
  /** URL do S3 - será armazenada em DocumentoOperacionalAssinatura.url */
  url: string
  /** Chave do objeto no S3 (para referência) */
  key: string
}

/** 
 * Tipos de URL que podemos encontrar em DocumentoOperacionalAssinatura.url
 */
enum AssinaturaUrlType {
  /** URL em formato data:mime;base64,... (dados legados) */
  DATA_URL = "DATA_URL",
  /** URL do S3/storage remoto (dados novos) */
  REMOTE_URL = "REMOTE_URL",
  /** Campo nulo ou vazio */
  EMPTY = "EMPTY",
}

// =============================================================================
// CONSTANTES
// =============================================================================

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/
const DATA_URL_PREFIX = "data:"

// =============================================================================
// FUNÇÕES AUXILIARES (PRIVADAS)
// =============================================================================

/**
 * Identifica o tipo de URL armazenada em DocumentoOperacionalAssinatura.url
 */
function identifyAssinaturaUrlType(url: string | null | undefined): AssinaturaUrlType {
  if (!url) return AssinaturaUrlType.EMPTY
  if (url.startsWith(DATA_URL_PREFIX)) return AssinaturaUrlType.DATA_URL
  return AssinaturaUrlType.REMOTE_URL
}

/**
 * Extrai mime type e dados base64 de uma data URL
 * @throws Error se formato inválido
 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(DATA_URL_PATTERN)
  if (!match) {
    throw new Error("Formato de data URL inválido. Esperado: data:<mime>;base64,<dados>")
  }
  return { mimeType: match[1], base64: match[2] }
}

/**
 * Determina extensão de arquivo a partir do mime type
 */
function getExtensionFromMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png"
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg"
  return "png" // fallback
}

/**
 * Gera a chave do objeto no S3 para assinatura de documento operacional
 */
function buildDocOperacionalAssinaturaS3Key(
  documentoOperacionalId: number, 
  role: string, 
  extension: string
): string {
  const timestamp = Date.now()
  return `documentos-operacionais/${documentoOperacionalId}/assinaturas/${role}_${timestamp}.${extension}`
}

/**
 * Baixa arquivo do S3 e converte para data URL
 * @returns data URL ou null se falhar
 */
async function fetchAndConvertToDataUrl(remoteUrl: string): Promise<string | null> {
  // 1. Obter URL assinada do S3 (necessário para objetos private)
  const signedUrl = await storage.getDownloadUrlFromStoredUrl(remoteUrl)
  if (!signedUrl) {
    console.error("[signatures] Não foi possível gerar URL assinada para:", remoteUrl)
    return null
  }

  // 2. Baixar o arquivo
  const response = await fetch(signedUrl)
  if (!response.ok) {
    console.error("[signatures] Falha ao baixar assinatura:", response.status, response.statusText)
    return null
  }

  // 3. Converter para base64
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  // 4. Montar data URL
  const contentType = response.headers.get("content-type") || "image/png"
  return `data:${contentType};base64,${base64}`
}

// =============================================================================
// FUNÇÕES PÚBLICAS
// =============================================================================

/**
 * Faz upload de uma assinatura de documento operacional para o S3
 * 
 * USADO EM: POST /api/documentos-operacionais/[id]/assinaturas
 * ARMAZENA EM: DocumentoOperacionalAssinatura.url
 * 
 * FLUXO:
 * 1. Recebe data URL do canvas (ex: data:image/png;base64,iVBOR...)
 * 2. Extrai o conteúdo binário
 * 3. Envia para S3 como objeto PRIVATE
 * 4. Retorna URL para armazenar em DocumentoOperacionalAssinatura.url
 * 
 * @example
 * const { url } = await uploadDocOperacionalAssinatura({
 *   documentoOperacionalId: 123,
 *   role: "funcionario_tecnico",
 *   dataUrl: canvasDataUrl
 * })
 * // Salvar url em DocumentoOperacionalAssinatura.url
 */
export async function uploadDocOperacionalAssinatura(
  input: DocOperacionalAssinaturaUploadInput
): Promise<DocOperacionalAssinaturaUploadResult> {
  const { documentoOperacionalId, role, dataUrl } = input

  // Validar e extrair dados do data URL
  const { mimeType, base64 } = parseDataUrl(dataUrl)
  const buffer = Buffer.from(base64, "base64")

  // Montar chave do S3
  const extension = getExtensionFromMime(mimeType)
  const key = buildDocOperacionalAssinaturaS3Key(documentoOperacionalId, role, extension)

  // Upload para S3 (private)
  const result = await storage.uploadPrivateObject({
    key,
    contentType: mimeType,
    body: buffer,
  })

  return {
    url: result.url,
    key: result.key,
  }
}

/**
 * Resolve URL de DocumentoOperacionalAssinatura.url para data URL
 * 
 * USADO EM: Geração de PDFs (termo-conclusao.tsx, relatorio-vistoria.tsx)
 * LÊ DE: DocumentoOperacionalAssinatura.url
 * 
 * COMPORTAMENTO:
 * - URL vazia/null → retorna null
 * - Data URL (dado legado) → retorna como está
 * - URL remota S3 (dado novo) → baixa e converte para data URL
 * 
 * POR QUE ISSO É NECESSÁRIO:
 * O @react-pdf/renderer precisa de data URLs para renderizar imagens.
 * URLs remotas do S3 não funcionam diretamente no PDF.
 * 
 * @example
 * // Assinatura legada (data URL direto no banco)
 * const url1 = "data:image/png;base64,iVBOR..."
 * await resolveDocOperacionalAssinaturaUrl(url1) // → mesma string
 * 
 * // Assinatura nova (URL do S3 no banco)
 * const url2 = "https://s3.../documentos-operacionais/123/assinaturas/tecnico.png"
 * await resolveDocOperacionalAssinaturaUrl(url2) // → "data:image/png;base64,..."
 */
export async function resolveDocOperacionalAssinaturaUrl(
  url: string | null | undefined
): Promise<string | null> {
  const urlType = identifyAssinaturaUrlType(url)

  switch (urlType) {
    case AssinaturaUrlType.EMPTY:
      return null

    case AssinaturaUrlType.DATA_URL:
      // Dado legado - já está no formato correto para PDF
      return url!

    case AssinaturaUrlType.REMOTE_URL:
      // Dado novo - precisa baixar do S3 e converter para data URL
      try {
        return await fetchAndConvertToDataUrl(url!)
      } catch (error) {
        console.error("[doc-operacional-assinatura] Erro ao resolver URL do S3:", error)
        return null
      }
  }
}

/**
 * Resolve múltiplas assinaturas de documento operacional em paralelo
 * 
 * USADO EM: Quando um documento tem várias assinaturas (técnico + condomínio)
 * 
 * @example
 * const assinaturas = await prisma.documentoOperacionalAssinatura.findMany(...)
 * const resolvidas = await resolveMultipleDocOperacionalAssinaturas(assinaturas)
 */
export async function resolveMultipleDocOperacionalAssinaturas<T extends { url?: string | null }>(
  assinaturas: T[]
): Promise<(T & { resolvedUrl: string | null })[]> {
  return Promise.all(
    assinaturas.map(async (assinatura) => ({
      ...assinatura,
      resolvedUrl: await resolveDocOperacionalAssinaturaUrl(assinatura.url),
    }))
  )
}
