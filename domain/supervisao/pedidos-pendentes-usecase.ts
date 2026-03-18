import { PedidoStatus, PrismaClient } from "@prisma/client"
import { differenceInBusinessDays, subMonths } from "date-fns"

type PedidosPendentesResult = {
  data: Array<{
    id: number
    clienteId: number
    clienteRazaoSocial: string
    clienteCnpj: string
    endereco: string
    valorTotal: number
    criadoEm: Date
    orcamentoId: number | null
    diasEmAberto: number
    alerta: boolean
    possuiVisitaAtiva: boolean
    ultimaManutencaoConcluida: Date | null
    tipoVisita: string | null
  }>
  total: number
  alertas: number
}

type PartialCliente = {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
}

const buildEndereco = (cliente: PartialCliente) => {
  const partes: string[] = []
  if (cliente.logradouro) {
    const numero = cliente.numero ? `, ${cliente.numero}` : ""
    partes.push(`${cliente.logradouro}${numero}`)
  }
  if (cliente.complemento) {
    partes.push(cliente.complemento)
  }
  const bairroCidadeEstado = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - ")
  if (bairroCidadeEstado) {
    partes.push(bairroCidadeEstado)
  }
  return partes.join(" | ") || "Endereço não informado"
}

export async function getPedidosPendentes(
  prisma: PrismaClient
): Promise<PedidosPendentesResult> {
  const threeMonthsAgo = subMonths(new Date(), 3)
  const pedidos = await prisma.pedido.findMany({
    where: {
      status: PedidoStatus.AGUARDANDO,
      createdAt: { gte: threeMonthsAgo },
    },
    include: {
      cliente: {
        select: {
          id: true,
          razaoSocial: true,
          cnpj: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          cidade: true,
          estado: true,
        },
      },
      itens: {
        select: {
          quantidade: true,
          valorUnitarioPraticado: true,
          item: { select: { categoria: true } },
        },
      },
      visitasTecnicas: {
        select: {
          id: true,
          status: true,
          dataMarcada: true,
          listaExtras: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const clienteIds = Array.from(new Set(pedidos.map((p) => p.clienteId)))
  const concluidos = clienteIds.length
    ? await prisma.pedido.findMany({
      where: {
        status: PedidoStatus.CONCLUIDO,
        clienteId: { in: clienteIds },
      },
      select: { clienteId: true, createdAt: true },
      orderBy: [{ clienteId: "asc" }, { createdAt: "desc" }],
    })
    : []

  const ultimaPorCliente = new Map<number, Date>()
  for (const pedido of concluidos) {
    if (!ultimaPorCliente.has(pedido.clienteId)) {
      ultimaPorCliente.set(pedido.clienteId, pedido.createdAt)
    }
  }

  const data = pedidos.map((pedido) => {
    const valorTotal = pedido.itens.reduce(
      (acc, item) => acc + item.quantidade * item.valorUnitarioPraticado,
      0,
    )

    const diasEmAberto = differenceInBusinessDays(new Date(), pedido.createdAt)
    const possuiVisitaAtiva = pedido.visitasTecnicas.some((visita) => visita.status !== "CANCELADO")
    const alerta = !possuiVisitaAtiva && diasEmAberto > 3

    const totalVisitas = pedido.visitasTecnicas.length
    const passouPeloSac = pedido.visitasTecnicas.some((v) => v.listaExtras.length > 0)

    const temItensProduto = pedido.itens.some((it: any) => it.item?.categoria === "Produto")

    let tipoVisita: string | null = null
    if (pedido.tipoEspecial === "OS") {
      tipoVisita = "Ord. Serv."
    } else if (passouPeloSac) {
      tipoVisita = "Aguardando conclusão"
    } else if (totalVisitas === 0) {
      tipoVisita = temItensProduto ? "Primeira visita com peças" : "Primeira visita"
    }

    return {
      id: pedido.id,
      clienteId: pedido.cliente.id,
      clienteRazaoSocial: pedido.cliente.razaoSocial,
      clienteCnpj: pedido.cliente.cnpj,
      endereco: buildEndereco(pedido.cliente),
      estado: pedido.cliente.estado ?? null,
      cidade: pedido.cliente.cidade ?? null,
      valorTotal,
      criadoEm: pedido.createdAt,
      orcamentoId: pedido.orcamentoId,
      diasEmAberto,
      alerta,
      possuiVisitaAtiva,
      ultimaManutencaoConcluida: ultimaPorCliente.get(pedido.cliente.id) ?? null,
      tipoVisita,
    }
  })

  return {
    data,
    total: data.length,
    alertas: data.filter((item) => item.alerta).length,
  }
}

