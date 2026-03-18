
import { prisma } from "@/lib/prisma"
import { NfeIoGateway } from "../../infra/nfe-io-gateway"
import { getNfeConfig } from "../config/nfe-filial-config"
import { NfeStatus } from "@prisma/client"
import { SyncNfeUseCase } from "./sync-nfe.usecase"
import { resolveFilialId } from "@/app/api/orcamentos/filial-map"

type IssueNfeInput = {
    pedidoId: number
    filialId?: number // Opcional, se não passado pega do pedido
    extras?: any      // Dados dinâmicos (ex: codigoObra) para a factory
    overridePayload?: any // Se o usuário editou o JSON na mão, sobrescreve tudo
}

export class IssueNfeUseCase {
    private gateway: NfeIoGateway

    constructor(gateway?: NfeIoGateway) {
        this.gateway = gateway || new NfeIoGateway()
    }

    async execute(input: IssueNfeInput) {
        // 1. Buscando dados do pedido e cliente
        const pedido = await prisma.pedido.findUnique({
            where: { id: input.pedidoId },
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

        const valorTotal = pedido.itens.reduce((acc, item) => acc + (item.quantidade * item.valorUnitarioPraticado), 0)

        // 2. Determinar Filial (Prioridade: Input > Pedido > Resolver)
        let filialId = input.filialId || pedido.orcamento?.filialId

        if (!filialId) {
            const empresaId = pedido.orcamento?.empresaId
            const uf = pedido.cliente?.estado
            if (empresaId && uf) {
                const resolved = await resolveFilialId(prisma, empresaId, uf)
                if (resolved) {
                    filialId = resolved
                    // Salva vínculo para operações futuras (Sync, Download)
                    if (pedido.orcamentoId) {
                        await prisma.orcamento.update({
                            where: { id: pedido.orcamentoId },
                            data: { filialId: resolved }
                        })
                    }
                }
            }
        }

        if (!filialId) throw new Error("Filial não identificada para emissão de NF")

        // 3. Carregar Configuração da Filial
        let filialObj = pedido.orcamento?.filial
        if (!filialObj || filialObj.id !== filialId) {
            filialObj = await prisma.filial.findUnique({ where: { id: filialId } })
        }

        if (!filialObj) throw new Error(`Filial ID ${filialId} não encontrada.`)

        const nfeConfig = getNfeConfig(filialObj.empresaId, filialObj.uf)
        if (!nfeConfig) throw new Error(`Configuração de NFE não encontrada para Empresa ${filialObj.empresaId} / UF ${filialObj.uf}`)

        if (nfeConfig.active === false) {
            throw new Error(`Emissão de NFe está temporariamente desativada para a filial ${filialObj.uf}.`)
        }

        // 4. Verificar duplicidade (Bloquear se já houver CREATED, QUEUED ou AUTHORIZED)
        const existingNfe = await prisma.nfe.findFirst({
            where: {
                pedidoId: input.pedidoId,
                status: { in: ['CREATED', 'QUEUED', 'AUTHORIZED'] }
            }
        })
        if (existingNfe) throw new Error(`Já existe uma NF emitida ou em processamento para este pedido (Status: ${existingNfe.status})`)

        // 5. Construir Payload (Factory + Override)
        let payload = nfeConfig.factory.build(pedido, input.extras || {}, filialObj)

        if (input.overridePayload) {
            // Merge robusto: Mantém o que a factory gerou mas prioriza o que o usuário editou no front
            payload = {
                ...payload,
                ...input.overridePayload,
                // Garante que se houver sub-objetos que o usuário não mexeu (ex: location), eles não sumam
                // Se o overridePayload vier completo do front (V0 design), o spread simples já resolveria.
            }
        }

        // 6. PRÉ-RESERVA: Criar registro CREATED no banco para evitar race conditions
        console.log(`[IssueNFE] Criando reserva local para Pedido ${pedido.id}...`)
        const tempNfeIoId = `PENDING-${pedido.id}-${Date.now()}`

        // O valor real da nota é o que está no payload final (pode ter sido editado no front)
        const finalAmount = payload.servicesAmount

        const draftNfe = await prisma.nfe.create({
            data: {
                pedidoId: pedido.id,
                nfeIoId: tempNfeIoId, // Placeholder temporário
                companyId: nfeConfig.nfeIoCompanyId,
                status: 'CREATED',
                amountInCents: Math.round(finalAmount * 100),
                borrowerName: payload.borrower?.name,
                borrowerCnpj: payload.borrower?.federalTaxNumber,
            }
        })

        // 7. Enviar para Gateway
        console.log(`[IssueNFE] Emitindo na Nfe.io (Reserva ID: ${draftNfe.id})...`)
        console.log("=== PAYLOAD NFE.IO ===")
        console.log(JSON.stringify(payload, null, 2))
        console.log("======================")
        let result
        try {
            result = await this.gateway.issueServiceInvoice(nfeConfig.nfeIoCompanyId, payload)
        } catch (error: any) {
            console.error("[IssueNFE] Erro no Gateway:", error?.response?.data || error.message)

            // Marca como ERROR para desbloquear (ou manter histórico de falha)
            await prisma.nfe.update({
                where: { id: draftNfe.id },
                data: {
                    status: 'ERROR',
                    nfeIoId: `ERROR-${draftNfe.id}-${Date.now()}` // Mudar ID para evitar colisão? Não, update mantém. Mas se quiser permitir nova tentativa e unique index atrapalhar...
                    // O unique é [pedidoId, nfeIoId]. Se eu mantiver tempNfeIoId, não posso criar outro com mesmo tempNfeIoId (impossível pois tem timestamp).
                    // Não preciso mudar o nfeIoId para ERROR, mas ajuda a identificar visualmente.
                }
            })
            throw error
        }

        // 8. Sucesso: Atualizar registro com dados reais
        const nfeIoId = result.id
        const status = result.status === 'Issued' ? 'AUTHORIZED' : 'QUEUED'

        const nfe = await prisma.nfe.update({
            where: { id: draftNfe.id },
            data: {
                nfeIoId: nfeIoId, // ID Oficial
                status: status as NfeStatus,
                number: (result.number ? String(result.number) : undefined) as any,
                verificationCode: result.verificationCode,
                pdfUrl: null, // Será obtido via download/sync
            }
        })

        // 9. Sync Inicial (Tentar obter XML imediatamente se já disponível)
        if (status === 'AUTHORIZED') {
            try {
                console.log(`[IssueNFE] Tentando Sync imediato para obter XML (NFe ${nfe.id})...`)
                const sync = new SyncNfeUseCase(this.gateway)
                await sync.execute(nfe.id)
            } catch (e) {
                console.warn(`[IssueNFE] Falha no sync pós-emissão (non-blocking): ${e}`)
            }
        }

        return nfe
    }
}
