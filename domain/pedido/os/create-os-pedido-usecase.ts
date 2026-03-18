import { OrcamentoStatus, PedidoStatus, PedidoTipoEspecial, PrismaClient } from "@prisma/client"
import { resolveFilialId } from "@/app/api/orcamentos/filial-map"

type CreateOsPedidoInput = {
  clienteId: number
  creatorId: string
  empresaId: number
  observacoes?: string | null
  detalhamento?: string | null
  contratoId?: number | null
}

type CreateOsPedidoResult = {
  pedidoId: number
  orcamentoId: number
}

export async function createOsPedido(
  prisma: PrismaClient,
  input: CreateOsPedidoInput
): Promise<CreateOsPedidoResult> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: input.empresaId },
    select: { id: true },
  })

  if (!empresa) {
    throw new Error("Empresa não encontrada.")
  }

  const cliente = await prisma.client.findUnique({
    where: { id: input.clienteId },
    select: { id: true, categoria: true, estado: true },
  })

  if (!cliente) {
    throw new Error("Cliente não encontrado.")
  }

  return prisma.$transaction(async (tx) => {
    const filialId = await resolveFilialId(tx, input.empresaId, cliente.estado ?? null)
    const orcamento = await tx.orcamento.create({
      data: {
        clienteId: input.clienteId,
        empresaId: input.empresaId,
        filialId,
        status: OrcamentoStatus.APROVADO,
        parcelas: 0,
        vendedorId: input.creatorId,
      },
      select: { id: true },
    })

    const pedido = await tx.pedido.create({
      data: {
        orcamentoId: orcamento.id,
        clienteId: input.clienteId,
        vendedorId: input.creatorId,
        status: PedidoStatus.AGUARDANDO,
        tipoEspecial: PedidoTipoEspecial.OS,
        categoriaClienteNoMomento: cliente.categoria ?? null,
        observacoes: input.observacoes?.trim() ? input.observacoes.trim() : null,
        detalhamento: input.detalhamento?.trim() ? input.detalhamento.trim() : null,
        contratoId: input.contratoId ?? null,
      },
      select: { id: true },
    })

    return { pedidoId: pedido.id, orcamentoId: orcamento.id }
  })
}

