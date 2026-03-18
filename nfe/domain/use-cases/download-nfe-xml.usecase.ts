
import { prisma } from "@/lib/prisma"
import { NfeIoGateway } from "../../infra/nfe-io-gateway"
import { getNfeConfig } from "../config/nfe-filial-config"
import { SyncNfeUseCase } from "./sync-nfe.usecase"
import { storage } from "@/lib/storage"

export class DownloadNfeXmlUseCase {
    private gateway: NfeIoGateway

    constructor(gateway?: NfeIoGateway) {
        this.gateway = gateway || new NfeIoGateway()
    }

    async execute(nfeDbId: string): Promise<{ type: 'url' | 'content', data: string }> {
        if (!nfeDbId) throw new Error("ID da nota fiscal inválido ou ausente.")

        // 1. Busca NF primeiro para ver se já tem o XML (Cache/Storage)
        let nfe = await prisma.nfe.findUnique({
            where: { id: nfeDbId },
            include: { pedido: { include: { orcamento: { include: { filial: true } } } } }
        })
        if (!nfe) throw new Error("Nota fiscal não encontrada")

        // Se já tem no banco, retorna imediatamente e pula o Sync/API
        if (nfe.xml) {
            if (storage.isInternalUrl(nfe.xml)) {
                const signedUrl = await storage.getDownloadUrlFromStoredUrl(nfe.xml)
                return { type: 'url', data: signedUrl || nfe.xml }
            }
            return { type: 'content', data: nfe.xml }
        }

        // 2. Se não tem XML, tenta sincronizar status primeiro (pode ser que já tenha sido emitida)
        try {
            const sync = new SyncNfeUseCase(this.gateway)
            const syncResult = await sync.execute(nfeDbId)

            // Se o sync baixou o XML automaticamente, recarrega a nota
            if (syncResult.updated) {
                nfe = await prisma.nfe.findUnique({
                    where: { id: nfeDbId },
                    include: { pedido: { include: { orcamento: { include: { filial: true } } } } }
                }) as any

                if (nfe?.xml) {
                    if (storage.isInternalUrl(nfe.xml)) {
                        const signedUrl = await storage.getDownloadUrlFromStoredUrl(nfe.xml)
                        return { type: 'url', data: signedUrl || nfe.xml }
                    }
                    return { type: 'content', data: nfe.xml }
                }
            }
        } catch (error) {
            console.error(`[DownloadXML] Falha ao sincronizar status antes do download: ${error}`)
        }

        if (!nfe!.nfeIoId) throw new Error("Nota fiscal não possui ID externo")

        // 3. Busca Config
        const filialObj = nfe.pedido.orcamento?.filial as any
        if (!filialObj) throw new Error("Filial desconhecida")
        const config = getNfeConfig(filialObj.empresaId, filialObj.uf)
        if (!config) throw new Error("Configuração não encontrada")

        // 4. Baixa da API Nfe.io e Salva no Storage
        try {
            const xmlContent = await this.gateway.downloadXml(config.nfeIoCompanyId, nfe.nfeIoId)

            // Upload para Storage S3
            const key = `notafiscal/xml/${nfe.id}.xml`

            const { url } = await storage.uploadPrivateObject({
                key,
                contentType: "application/xml",
                body: Buffer.from(xmlContent)
            })

            // 5. Salva URL no banco
            await prisma.nfe.update({
                where: { id: nfeDbId },
                data: { xml: url }
            })

            // Retorna a URL assinada para o front
            const signedUrl = await storage.getDownloadUrlFromStoredUrl(url)
            return { type: 'url', data: signedUrl || url }
        } catch (err: any) {
            console.error("Erro ao baixar XML:", err)
            throw new Error("Não foi possível obter o XML da nota.")
        }
    }
}
