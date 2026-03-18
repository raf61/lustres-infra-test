import { Prisma, PrismaClient } from "@prisma/client"

type TransactionClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

export async function ensureDebitos(
    prisma: PrismaClient | TransactionClient,
    pedidoId: number
) {
    // 1. Verifica se já existem débitos
    const count = await prisma.debito.count({ where: { pedidoId } })
    if (count > 0) {
        // Já existem débitos, não faz nada (idempotente)
        return { created: false, message: "Débitos já existem para este pedido." }
    }

    // 2. Busca dados do pedido
    const pedido = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        include: {
            cliente: { select: { id: true } },
            orcamento: { select: { parcelas: true, primeiroVencimento: true } },
            itens: { select: { quantidade: true, valorUnitarioPraticado: true } },
        },
    })

    if (!pedido) {
        throw new Error("Pedido não encontrado.")
    }

    // Validação de Banco Emissor
    if (!pedido.bancoEmissorId) {
        throw new Error("Pedido não possui Banco Emissor definido. configure o banco no pedido antes de gerar débitos.")
    }

    const inputs = {
        parcelas: pedido.orcamento?.parcelas,
        primeiroVencimento: pedido.orcamento?.primeiroVencimento,
    }

    const { parcelas, primeiroVencimento } = inputs

    if (!firstDateIsValid(primeiroVencimento)) {
        throw new Error("Primeiro vencimento não definido no orçamento.")
    }
    if (!parcelas || parcelas <= 0) {
        throw new Error("Número de parcelas inválido no orçamento.")
    }

    // 3. Calcula total
    const totalPedido = pedido.itens.reduce(
        (sum, item) => sum + item.quantidade * item.valorUnitarioPraticado,
        0
    )

    if (totalPedido <= 0) {
        // Se o total for zero (ex: bonificação ou contrato), não gera débitos
        return { created: false, message: "Pedido com valor zero, nenhum débito gerado." }
    }

    // 4. Calcula parcelas
    const baseDate = new Date(primeiroVencimento!)
    const parcelaBase = Number((totalPedido / parcelas).toFixed(2))
    let acumulado = 0

    const debitosPayload = Array.from({ length: parcelas }).map((_, index) => {
        let valorParcela = parcelaBase
        // Ajuste na última parcela para arredondamento
        if (index === parcelas - 1) {
            valorParcela = Number((totalPedido - acumulado).toFixed(2))
        } else {
            acumulado += valorParcela
        }

        const vencimento = new Date(baseDate)
        vencimento.setMonth(vencimento.getMonth() + index)

        return {
            pedidoId: pedido.id,
            clienteId: pedido.cliente.id,
            receber: valorParcela,
            dataOcorrencia: null,
            recebido: null,
            vencimento,
            acrescimos: null,
            descontos: null,
            email: null,
            banCobrador: null,
            stats: 0,
            remessa: false,
            linkBoleto: null,
        }
    })

    // 5. Cria débitos
    await prisma.debito.createMany({ data: debitosPayload })

    return { created: true, count: debitosPayload.length }
}

function firstDateIsValid(date: Date | null | undefined): boolean {
    return !!date && !isNaN(date.getTime())
}
