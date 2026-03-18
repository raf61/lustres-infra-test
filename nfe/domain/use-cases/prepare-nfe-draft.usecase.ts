
import { prisma } from "@/lib/prisma"
import { getNfeConfig } from "../config/nfe-filial-config"
import { resolveFilialId } from "@/app/api/orcamentos/filial-map"

export class PrepareNfeDraftUseCase {
    async execute(pedidoId: number) {
        // 1. Dados
        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            include: {
                cliente: true,
                orcamento: {
                    include: { filial: true }
                },
                itens: {
                    include: { item: true }
                }
            }
        })

        if (!pedido) throw new Error("Pedido não encontrado")
        let filialId = pedido.orcamento?.filialId

        // Se não tiver filial vinculada, tenta resolver via mapa (Empresa x UF)
        if (!filialId) {
            const empresaId = pedido.orcamento?.empresaId
            const uf = pedido.cliente?.estado
            if (empresaId && uf) {
                const resolved = await resolveFilialId(prisma, empresaId, uf)
                if (resolved) filialId = resolved
            }
        }

        if (!filialId) throw new Error("Filial não identificada e não pôde ser resolvida automaticamente.")

        // 2. Carregar Filial e Config
        let filialObj = pedido.orcamento?.filial
        if (!filialObj || filialObj.id !== filialId) {
            filialObj = await prisma.filial.findUnique({ where: { id: filialId } })
        }

        if (!filialObj) throw new Error(`Filial ID ${filialId} não encontrada no banco de dados.`)

        const config = getNfeConfig(filialObj.empresaId, filialObj.uf)
        if (!config) throw new Error(`Configuração fiscal não encontrada para Empresa ${filialObj.empresaId} / UF ${filialObj.uf}`)

        // 3. Factory e Metadata
        const Factory = config.factory

        // Gera um payload inicial (sem extras) para servir de base
        // Passa objeto FILIAL para a factory extrair dados cadastrais
        const initialPayload = Factory.build(pedido, {}, filialObj)

        // Identifica quais campos extras o frontend deve pedir
        const requiredExtras = (Factory as any).getRequiredExtras ? (Factory as any).getRequiredExtras() : []

        return {
            filialId,
            initialPayload,
            requiredExtras,
            companyId: config.nfeIoCompanyId
        }
    }
}
