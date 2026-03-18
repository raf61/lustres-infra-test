
import { prisma } from "@/lib/prisma"
import { NfeIoGateway } from "../../infra/nfe-io-gateway"
import { getNfeConfig } from "../config/nfe-filial-config"
import { SyncNfeUseCase } from "./sync-nfe.usecase"

export class CancelNfeUseCase {
    private gateway: NfeIoGateway

    constructor(gateway?: NfeIoGateway) {
        this.gateway = gateway || new NfeIoGateway()
    }

    async execute(nfeDbId: string) {
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

        if (!nfe) throw new Error("Nota fiscal não encontrada.")
        if (!nfe.nfeIoId) throw new Error("ID da Nfe.io ausente.")
        if (nfe.status === 'CANCELLED') throw new Error("Esta nota já está cancelada.")

        // 2. Determina configurações
        const filialObj = nfe.pedido.orcamento?.filial
        if (!filialObj) throw new Error("Filial não identificada.")

        const config = getNfeConfig(filialObj.empresaId, filialObj.uf)
        if (!config?.nfeIoCompanyId) throw new Error("Configuração da Nfe.io não encontrada.")

        // 3. Solicita cancelamento no Gateway
        console.log(`[CancelNfe] Solicitando cancelamento para Nfe.io ID: ${nfe.nfeIoId}...`)

        try {
            await this.gateway.cancelServiceInvoice(config.nfeIoCompanyId, nfe.nfeIoId)

            // 4. Importante: Nfe.io pode não cancelar na hora (depende da prefeitura)
            // Mas marcamos como processando ou simplesmente fazemos um sync logo depois.
            console.log(`[CancelNfe] Solicitação enviada. Executando sync para atualizar status...`)

            const sync = new SyncNfeUseCase(this.gateway)
            return await sync.execute(nfe.id)

        } catch (error: any) {
            console.error(`[CancelNfe] Erro ao cancelar:`, error)
            throw new Error(`Falha ao cancelar nota na Nfe.io: ${error.message}`)
        }
    }
}
