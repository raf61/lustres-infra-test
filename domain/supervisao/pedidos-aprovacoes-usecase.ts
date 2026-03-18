import { ListaExtraStatus, PedidoStatus, PrismaClient } from "@prisma/client"
import { differenceInBusinessDays } from "date-fns"

type PedidosAprovacoesResult = {
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
    listaExtraRejeitada: boolean
    tipoVisita: string | null
  }>
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

export async function getPedidosAprovacoes(
  prisma: PrismaClient
): Promise<PedidosAprovacoesResult> {
  const pedidos = (await prisma.pedido.findMany({
    where: { status: PedidoStatus.AGUARDANDO_APROVACAO_SUPERVISAO },
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
          listaExtras: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })) as any[]

  const data = pedidos.map((pedido: any) => {
    const valorTotal = pedido.itens.reduce(
      (acc: number, item: any) => acc + item.quantidade * item.valorUnitarioPraticado,
      0,
    )
    const diasEmAberto = differenceInBusinessDays(new Date(), pedido.createdAt)
    const alerta = diasEmAberto > 3

    const totalVisitas = pedido.visitasTecnicas.length
    const passouPeloSac = pedido.visitasTecnicas.some((v: any) =>
      v.listaExtras.some(
        (lista: any) =>
          lista.status === ListaExtraStatus.APROVADO ||
          lista.status === ListaExtraStatus.REJEITADO
      )
    )

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
      listaExtraRejeitada: pedido.visitasTecnicas.some((visita: any) =>
        visita.listaExtras.some((lista: any) => lista.status === ListaExtraStatus.REJEITADO)
      ),
      tipoVisita,
      medicaoOhmica: pedido.medicaoOhmica ?? null,
      medicaoOhmicaMulti: pedido.medicaoOhmicaMulti ?? null,
    }
  })

  return { data }
}

