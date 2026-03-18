import { prisma } from "@/lib/prisma"
import { NfeIoGateway } from "../../infra/nfe-io-gateway"
import { getNfeConfig } from "../config/nfe-filial-config"
import { SyncNfeUseCase } from "./sync-nfe.usecase"
import { storage } from "@/lib/storage"

export class DownloadNfeUseCase {
    private gateway: NfeIoGateway

    constructor(gateway?: NfeIoGateway) {
        this.gateway = gateway || new NfeIoGateway()
    }

    /**
     * Retorna a URL assinada ou o Buffer do PDF da nota
     */
    async execute(nfeId: string): Promise<{ type: 'url' | 'content', data: string | Buffer }> {
        if (!nfeId) throw new Error("ID da nota fiscal inválido ou ausente.")

        // 1. Busca NF primeiro para ver se precisa de Sync
        const nfeBefore = await prisma.nfe.findUnique({
            where: { id: nfeId },
            include: {
                pedido: {
                    include: {
                        orcamento: {
                            include: { filial: true }
                        }
                    }
                }
            }
        })

        if (!nfeBefore) throw new Error("Nota Fiscal não encontrada no sistema.")

        // 2. Só tenta Sync se NÃO estiver autorizada ou cancelada (Robustez)
        // Ou se estiver autorizada mas faltar o número (para garantir que temos os dados)
        if (nfeBefore.status !== 'AUTHORIZED' && nfeBefore.status !== 'CANCELLED' || (nfeBefore.status === 'AUTHORIZED' && !nfeBefore.number)) {
            try {
                console.log(`[DownloadPDF] Status atual: ${nfeBefore.status}. Rodando sync preventivo (max 15s)...`)
                const sync = new SyncNfeUseCase(this.gateway)
                // Usamos um timeout curto para não travar a requisição do usuário se a prefeitura for lenta
                await sync.execute(nfeId, 15000)
            } catch (error) {
                console.warn(`[DownloadPDF] Sync preventivo ignorado ou timeout: ${error instanceof Error ? error.message : error}`)
                // Prossegue mesmo com erro de sync, para tentar baixar com o que tem
            }
        }

        // 3. Re-carrega os dados se houve sync ou se precisamos dos IDs
        const nfe = nfeBefore.status === 'AUTHORIZED' ? nfeBefore : await prisma.nfe.findUnique({
            where: { id: nfeId },
            include: {
                pedido: { include: { orcamento: { include: { filial: true } } } }
            }
        })

        if (!nfe || !nfe.nfeIoId) throw new Error("Nota Fiscal não encontrada ou ID externo ausente.")

        // 2. Busca Config da Filial (para ter o companyId)
        const filialObj = nfe.pedido.orcamento?.filial
        if (!filialObj) throw new Error("Filial do pedido não encontrada.")

        const config = getNfeConfig(filialObj.empresaId, filialObj.uf)
        if (!config) throw new Error("Configuração fiscal da filial não encontrada.")

        // 3. Verificar se já temos PDF no S3
        if (nfe.pdfUrl) {
            if (storage.isInternalUrl(nfe.pdfUrl)) {
                const signedUrl = await storage.getDownloadUrlFromStoredUrl(nfe.pdfUrl)
                return { type: 'url', data: signedUrl || nfe.pdfUrl }
            }
            return { type: 'url', data: nfe.pdfUrl }
        }

        // 4. Download e Upload para S3
        console.log(`[DownloadPDF] Baixando PDF e salvando no S3 (NFe ${nfe.id})...`)
        const buffer = await this.gateway.downloadPdf(config.nfeIoCompanyId, nfe.nfeIoId)

        const key = `notafiscal/pdf/${nfe.id}.pdf`
        const { url } = await storage.uploadPrivateObject({
            key,
            contentType: "application/pdf",
            body: buffer
        })

        // 5. Salva URL no banco
        await prisma.nfe.update({
            where: { id: nfeId },
            data: { pdfUrl: url }
        })

        const signedUrl = await storage.getDownloadUrlFromStoredUrl(url)
        return { type: 'url', data: signedUrl || url }
    }
}
