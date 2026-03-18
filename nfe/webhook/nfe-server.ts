/**
 * NFe.io Webhook Server
 * 
 * Servidor standalone que recebe webhooks da Nfe.io e atualiza o status
 * das notas fiscais no banco de dados. Comportamento idêntico ao SyncNfeUseCase.
 * 
 * Eventos tratados:
 *   - issued_successfully  → status AUTHORIZED + download XML
 *   - issued_error         → status ERROR
 *   - issued_failed        → status ERROR
 *   - cancelled_successfully → status CANCELLED
 *   - cancelled_error      → apenas log (mantém status atual para permitir nova tentativa)
 *   - cancelled_failed     → apenas log (mantém status atual para permitir nova tentativa)
 */

// @ts-ignore - Express types not installed
import express from 'express'
import crypto from 'crypto'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

dotenv.config()

// ─── Prisma ────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error']
})

// ─── S3 Storage (inline, sem depender de @/ alias) ─────────────────────────────
function getEnv(name: string): string {
    const v = process.env[name]
    if (!v) throw new Error(`[nfe-webhook] Missing env: ${name}`)
    return v
}

function getS3Client() {
    const region = getEnv('S3_REGION')
    const host = getEnv('S3_HOST')
    const endpoint = host.startsWith('http') ? host : `https://${host}`
    return new S3Client({
        region,
        endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: getEnv('S3_ACCESS_KEY'),
            secretAccessKey: getEnv('S3_SECRET_KEY'),
        },
    })
}

async function uploadXmlToS3(nfeDbId: string, xmlContent: string): Promise<string> {
    const bucket = getEnv('S3_BUCKET')
    const key = `notafiscal/xml/${nfeDbId}.xml`
    const client = getS3Client()

    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(xmlContent),
        ContentType: 'application/xml',
        ACL: 'private',
    }))

    const endpoint = (getEnv('S3_HOST').startsWith('http') ? getEnv('S3_HOST') : `https://${getEnv('S3_HOST')}`).replace(/\/$/, '')
    return `${endpoint}/${bucket}/${key}`
}

// ─── NFe.io API Helper ─────────────────────────────────────────────────────────
async function downloadXmlFromNfeIo(companyId: string, invoiceId: string): Promise<string> {
    const apiKey = process.env.NFE_IO_API_KEY
    if (!apiKey) throw new Error('NFE_IO_API_KEY não configurada')

    const url = `https://api.nfe.io/v1/companies/${companyId}/serviceinvoices/${invoiceId}/xml`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000)

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': apiKey },
            signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Nfe.io XML download failed: ${res.status}`)
        return await res.text()
    } finally {
        clearTimeout(timeout)
    }
}

// ─── Buscar NFe local pelo nfeIoId ─────────────────────────────────────────────
async function findNfeByIoId(nfeIoId: string) {
    return prisma.nfe.findFirst({
        where: { nfeIoId },
    })
}

// ─── Handlers por ação ─────────────────────────────────────────────────────────
//
// Cada handler recebe o payload completo do webhook e é IDEMPOTENTE:
// se chamado múltiplas vezes com o mesmo payload, o resultado é o mesmo.
//
// O comportamento é IDÊNTICO ao SyncNfeUseCase para o mesmo status.

/**
 * issued_successfully → AUTHORIZED
 * 
 * Coerente com SyncNfeUseCase quando remoteStatus === 'Issued':
 * - Seta status AUTHORIZED
 * - Salva number, verificationCode, issuedOn
 * - Se não tem XML, baixa e salva no S3
 */
async function handleIssuedSuccessfully(payload: any): Promise<{ updated: boolean; action: string }> {
    const nfe = await findNfeByIoId(payload.id)
    if (!nfe) {
        console.warn(`[nfe-webhook] issued_successfully: NFe não encontrada para nfeIoId=${payload.id}`)
        return { updated: false, action: 'issued_successfully' }
    }

    // Idempotência: se já está AUTHORIZED com número, verifica se precisa de XML apenas
    if (nfe.status === 'AUTHORIZED' && nfe.number && nfe.xml) {
        console.log(`[nfe-webhook] issued_successfully: NFe ${nfe.id} já está AUTHORIZED com XML. Ignorando.`)
        return { updated: false, action: 'issued_successfully' }
    }

    const updateData: any = {
        status: 'AUTHORIZED',
        number: payload.number ? String(payload.number) : undefined,
        verificationCode: payload.checkCode || payload.verificationCode || undefined,
        issuedOn: payload.issuedOn ? new Date(payload.issuedOn) : undefined,
    }

    // Coerência com SyncNfe: Se não tem XML, baixa agora (conformidade legal)
    if (!nfe.xml) {
        try {
            console.log(`[nfe-webhook] Baixando XML para conformidade legal (NFe ${nfe.id})...`)
            const xmlContent = await downloadXmlFromNfeIo(nfe.companyId, nfe.nfeIoId)
            if (xmlContent) {
                const url = await uploadXmlToS3(nfe.id, xmlContent)
                updateData.xml = url
                console.log(`[nfe-webhook] XML salvo: ${url}`)
            }
        } catch (err) {
            console.error(`[nfe-webhook] Falha ao baixar XML automático: ${err}`)
            // Não falhar o webhook inteiro se o XML falhar (pode ser instabilidade pontual)
        }
    }

    await prisma.nfe.update({ where: { id: nfe.id }, data: updateData })
    console.log(`[nfe-webhook] ✅ NFe ${nfe.id} → AUTHORIZED (number: ${updateData.number})`)
    return { updated: true, action: 'issued_successfully' }
}

/**
 * issued_error → ERROR
 * 
 * Coerente com SyncNfeUseCase quando remoteStatus === 'Error' ou 'Denied'
 */
async function handleIssuedError(payload: any): Promise<{ updated: boolean; action: string }> {
    const nfe = await findNfeByIoId(payload.id)
    if (!nfe) {
        console.warn(`[nfe-webhook] issued_error: NFe não encontrada para nfeIoId=${payload.id}`)
        return { updated: false, action: 'issued_error' }
    }

    // Idempotência: já está em ERROR
    if (nfe.status === 'ERROR') {
        console.log(`[nfe-webhook] issued_error: NFe ${nfe.id} já está ERROR. Ignorando.`)
        return { updated: false, action: 'issued_error' }
    }

    // Não sobrescreve um status "final positivo"
    if (nfe.status === 'AUTHORIZED') {
        console.warn(`[nfe-webhook] issued_error: NFe ${nfe.id} já está AUTHORIZED. Não vou regredir para ERROR.`)
        return { updated: false, action: 'issued_error' }
    }

    const flowMessage = payload.flowMessage || ''
    await prisma.nfe.update({ where: { id: nfe.id }, data: { status: 'ERROR' } })
    console.log(`[nfe-webhook] ❌ NFe ${nfe.id} → ERROR (flowMessage: ${flowMessage})`)
    return { updated: true, action: 'issued_error' }
}

/**
 * issued_failed → ERROR
 * 
 * Mesmo comportamento que issued_error
 */
async function handleIssuedFailed(payload: any): Promise<{ updated: boolean; action: string }> {
    const nfe = await findNfeByIoId(payload.id)
    if (!nfe) {
        console.warn(`[nfe-webhook] issued_failed: NFe não encontrada para nfeIoId=${payload.id}`)
        return { updated: false, action: 'issued_failed' }
    }

    if (nfe.status === 'ERROR') {
        console.log(`[nfe-webhook] issued_failed: NFe ${nfe.id} já está ERROR. Ignorando.`)
        return { updated: false, action: 'issued_failed' }
    }

    if (nfe.status === 'AUTHORIZED') {
        console.warn(`[nfe-webhook] issued_failed: NFe ${nfe.id} já está AUTHORIZED. Não vou regredir para ERROR.`)
        return { updated: false, action: 'issued_failed' }
    }

    const flowMessage = payload.flowMessage || ''
    await prisma.nfe.update({ where: { id: nfe.id }, data: { status: 'ERROR' } })
    console.log(`[nfe-webhook] ❌ NFe ${nfe.id} → ERROR (issued_failed, msg: ${flowMessage})`)
    return { updated: true, action: 'issued_failed' }
}

/**
 * cancelled_successfully → CANCELLED
 * 
 * Coerente com SyncNfeUseCase quando remoteStatus === 'Cancelled'
 */
async function handleCancelledSuccessfully(payload: any): Promise<{ updated: boolean; action: string }> {
    const nfe = await findNfeByIoId(payload.id)
    if (!nfe) {
        console.warn(`[nfe-webhook] cancelled_successfully: NFe não encontrada para nfeIoId=${payload.id}`)
        return { updated: false, action: 'cancelled_successfully' }
    }

    // Idempotência: já está cancelada
    if (nfe.status === 'CANCELLED') {
        console.log(`[nfe-webhook] cancelled_successfully: NFe ${nfe.id} já está CANCELLED. Ignorando.`)
        return { updated: false, action: 'cancelled_successfully' }
    }

    await prisma.nfe.update({ where: { id: nfe.id }, data: { status: 'CANCELLED' } })
    console.log(`[nfe-webhook] 🚫 NFe ${nfe.id} → CANCELLED`)
    return { updated: true, action: 'cancelled_successfully' }
}

/**
 * cancelled_error → NÃO altera status
 * 
 * Falha ao cancelar: a nota continua com o status atual.
 * Não setamos ERROR para que o usuário possa tentar cancelar novamente.
 * Apenas logamos para investigação.
 */
async function handleCancelledError(payload: any): Promise<{ updated: boolean; action: string }> {
    const nfe = await findNfeByIoId(payload.id)
    if (!nfe) {
        console.warn(`[nfe-webhook] cancelled_error: NFe não encontrada para nfeIoId=${payload.id}`)
        return { updated: false, action: 'cancelled_error' }
    }

    const flowMessage = payload.flowMessage || ''
    console.error(`[nfe-webhook] ⚠️ Falha no cancelamento da NFe ${nfe.id} (nfeIoId: ${payload.id}). Status mantido: ${nfe.status}. Msg: ${flowMessage}`)
    return { updated: false, action: 'cancelled_error' }
}

/**
 * cancelled_failed → NÃO altera status
 * 
 * Mesmo comportamento que cancelled_error: mantém status para permitir retry.
 */
async function handleCancelledFailed(payload: any): Promise<{ updated: boolean; action: string }> {
    const nfe = await findNfeByIoId(payload.id)
    if (!nfe) {
        console.warn(`[nfe-webhook] cancelled_failed: NFe não encontrada para nfeIoId=${payload.id}`)
        return { updated: false, action: 'cancelled_failed' }
    }

    const flowMessage = payload.flowMessage || ''
    console.error(`[nfe-webhook] ⚠️ Falha no cancelamento da NFe ${nfe.id} (nfeIoId: ${payload.id}). Status mantido: ${nfe.status}. Msg: ${flowMessage}`)
    return { updated: false, action: 'cancelled_failed' }
}

// ─── Registry de handlers ──────────────────────────────────────────────────────
// Para adicionar um novo evento, basta criar a função e adicionar aqui.
const ACTION_HANDLERS: Record<string, (payload: any) => Promise<{ updated: boolean; action: string }>> = {
    'issued_successfully': handleIssuedSuccessfully,
    'issued_error': handleIssuedError,
    'issued_failed': handleIssuedFailed,
    'cancelled_successfully': handleCancelledSuccessfully,
    'cancelled_error': handleCancelledError,
    'cancelled_failed': handleCancelledFailed,
}

// ─── Express Server ────────────────────────────────────────────────────────────
function startNfeWebhookServer() {
    const app = express()
    const PORT = Number(process.env.NFE_WEBHOOK_PORT || 4002)

    // Capturar rawBody para validação HMAC
    app.use(express.json({
        verify: (req: any, _res: any, buf: any) => {
            req.rawBody = buf
        }
    }))

    // ─── Health Check ──────────────────────────────────────────────────────────
    app.get('/health', (_req: any, res: any) => {
        res.json({ status: 'ok', service: 'nfe-webhook', uptime: process.uptime() })
    })

    // ─── POST: Webhook endpoint ────────────────────────────────────────────────
    app.post('/webhook', async (req: any, res: any) => {
        const startTime = Date.now()

        try {
            const action = req.body?.action
            const payload = req.body?.payload

            // Check inicial do payload (retorna 200 para configurar o webhook na Nfe.io)
            if (!action || !payload?.id) {
                console.warn('[nfe-webhook] Payload inválido ou vazio (cheque de configuração?):', JSON.stringify(req.body))
                return res.status(200).json({ received: true })
            }

            // ─── Validação de Assinatura (após check de payload) ───
            const secret = process.env.NFE_IO_WEBHOOK_SECRET
            if (secret) {
                const signature =
                    req.headers['x-nfe-signature'] ||
                    req.headers['x-nfeio-signature'] ||
                    req.headers['x-hub-signature'] ||
                    req.headers['x-webhook-signature']

                if (signature) {
                    try {
                        const hmac = crypto.createHmac('sha1', secret)
                        const digest = hmac.update(req.rawBody).digest('hex')
                        const cleanSig = (signature as string).replace(/^sha1=/, '').replace(/^sha256=/, '').toLowerCase()

                        const sigBuffer = Buffer.from(cleanSig, 'hex')
                        const digestBuffer = Buffer.from(digest, 'hex')

                        if (sigBuffer.length === digestBuffer.length && crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
                            console.log(`[nfe-webhook] ✅ Assinatura validada (${action})`)
                        } else {
                            console.log('erro')
                            console.error(`[nfe-webhook] ❌ Mismatch de assinatura! (Modo permissivo: continuando...)`)
                        }
                    } catch (e: any) {
                        console.error(`[nfe-webhook] ❌ Erro ao processar HMAC: ${e.message}`)
                    }
                } else {
                    console.warn(`[nfe-webhook] ⚠️ Signature header ausente para action=${action}. (Continuando...)`)
                }
            } else {
                if (process.env.NODE_ENV === 'production') {
                    console.error('[nfe-webhook] CRITICAL: NFE_IO_WEBHOOK_SECRET missing in production!')
                }
            }

            console.log(`[nfe-webhook] ← Recebido: action=${action} nfeIoId=${payload.id} flowStatus=${payload.flowStatus || 'N/A'}`)

            const handler = ACTION_HANDLERS[action]
            if (!handler) {
                console.warn(`[nfe-webhook] Ação desconhecida: "${action}". Ignorando.`)
                return res.status(200).json({ received: true, handled: false, action })
            }

            const result = await handler(payload)
            const elapsed = Date.now() - startTime

            console.log(`[nfe-webhook] → Processado: action=${action} updated=${result.updated} (${elapsed}ms)`)
            return res.status(200).json({ received: true, ...result })

        } catch (error: any) {
            console.error('[nfe-webhook] Erro crítico:', error)
            return res.status(500).json({ error: error.message || 'Internal server error' })
        }
    })

    app.listen(PORT, () => {
        console.log(`[nfe-webhook] 🚀 Listening on port ${PORT}`)
        console.log(`[nfe-webhook] Handlers registrados: ${Object.keys(ACTION_HANDLERS).join(', ')}`)
        console.log(`[nfe-webhook] HMAC: ${process.env.NFE_IO_WEBHOOK_SECRET ? '✅ Ativo' : '⚠️ Desativado (dev)'}`)
    })
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
    startNfeWebhookServer()
}

export { startNfeWebhookServer }
