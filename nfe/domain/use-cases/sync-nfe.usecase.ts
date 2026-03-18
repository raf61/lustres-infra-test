
import { prisma } from "@/lib/prisma"
import { NfeIoGateway } from "../../infra/nfe-io-gateway"
import { getNfeConfig } from "../config/nfe-filial-config"
import { storage } from "@/lib/storage"

export class SyncNfeUseCase {
    private gateway: NfeIoGateway

    constructor(gateway?: NfeIoGateway) {
        this.gateway = gateway || new NfeIoGateway()
    }

    async execute(nfeDbId: string, timeout = 60000) {
        // 1. Busca a nota localmente
        const nfe = await prisma.nfe.findUnique({
            where: { id: nfeDbId },
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

        if (!nfe) throw new Error("Nota fiscal não encontrada no sistema.")
        if (!nfe.nfeIoId) throw new Error("Esta nota não possui ID externo vinculado.")

        // 2. Determina configurações da filial (Company ID)
        const filialObj = nfe.pedido.orcamento?.filial
        if (!filialObj) throw new Error("Filial não identificada para este pedido.")

        const config = getNfeConfig(filialObj.empresaId, filialObj.uf)
        if (!config?.nfeIoCompanyId) throw new Error(`Configuração NFe não encontrada para Empresa ${filialObj.empresaId} / UF ${filialObj.uf}`)

        // 3. Consulta API da Nfe.io
        let remoteNfe
        try {
            remoteNfe = await this.gateway.fetchServiceInvoice(config.nfeIoCompanyId, nfe.nfeIoId, timeout)
        } catch (error: any) {
            console.error("[SyncNfe] Erro ao buscar na API:", error)
            // Se for 404, talvez foi deletada?
            throw new Error(`Erro ao consultar Nfe.io: ${error.message}`)
        }

        // 4. Mapeia Status e Atualiza
        // Status Nfe.io: 'Issued', 'Cancelled', 'Error', 'Denied', 'Waiting', 'None'
        let newStatus = nfe.status
        let updateData: any = {}

        const remoteStatus = remoteNfe.status || remoteNfe.flowStatus // flowStatus as vezes é usado em WaitingDownload

        if (remoteStatus === 'Issued') {
            newStatus = 'AUTHORIZED'
            updateData = {
                status: 'AUTHORIZED',
                number: remoteNfe.number ? String(remoteNfe.number) : undefined,
                verificationCode: remoteNfe.checkCode || remoteNfe.verificationCode,
                issuedOn: remoteNfe.issuedOn ? new Date(remoteNfe.issuedOn) : undefined,
            }

            // Lei exige guardar XML. Se não tivermos, baixamos agora.
            if (!nfe.xml) {
                try {
                    console.log(`[SyncNfe] Baixando XML para conformidade legal (NFe ${nfe.id})...`)
                    const xmlContent = await this.gateway.downloadXml(config.nfeIoCompanyId, nfe.nfeIoId)
                    if (xmlContent) {
                        // Upload para Storage S3
                        const key = `notafiscal/xml/${nfe.id}.xml`
                        console.log(`[SyncNfe] Fazendo upload para storage: ${key}`)

                        const { url } = await storage.uploadPrivateObject({
                            key,
                            contentType: "application/xml",
                            body: Buffer.from(xmlContent)
                        })

                        updateData.xml = url // Salva URL no banco
                    }
                } catch (err) {
                    console.error(`[SyncNfe] Falha ao baixar XML automático: ${err}`)
                    // Não falhar o sync inteiro se o XML falhar (pode ser instabilidade pontual)
                }
            }

        } else if (remoteStatus === 'Cancelled') {
            newStatus = 'CANCELLED'
            updateData = { status: 'CANCELLED' }
        } else if (remoteStatus === 'Error' || remoteStatus === 'Denied') {
            newStatus = 'ERROR'
            updateData = { status: 'ERROR' }
        }

        // Se houve mudança de status, dados faltantes (numero) ou XML novo
        const hasXmlUpdate = !!updateData.xml
        const shouldUpdate = newStatus !== nfe.status ||
            (newStatus === 'AUTHORIZED' && !nfe.number) ||
            hasXmlUpdate

        if (shouldUpdate) {
            const updated = await prisma.nfe.update({
                where: { id: nfeDbId },
                data: updateData
            })
            return { updated: true, nfe: updated, remote: remoteNfe }
        }

        return { updated: false, nfe, remote: remoteNfe }
    }
}
