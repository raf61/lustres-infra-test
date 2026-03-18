import { PrismaClient, VisitaTecnicaStatus } from "@prisma/client"
import { differenceInBusinessDays } from "date-fns"

type VisitasAgendadasResult = {
  data: Array<{
    id: number
    pedidoId: number | null
    pedidoStatus: string | null
    orcamentoId: number
    clienteId: number
    clienteRazaoSocial: string
    clienteCnpj: string
    endereco: string
    dataMarcada: Date
    dataRegistroInicio: Date | null
    status: string
    tecnicoId: string | null
    tecnicoNome: string
    diasDesdeMarcacao: number
    atrasada: boolean
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

export async function getVisitasAgendadas(
  prisma: PrismaClient
): Promise<VisitasAgendadasResult> {
  const visitas = await prisma.visitaTecnica.findMany({
    where: {
      status: {
        in: [VisitaTecnicaStatus.AGUARDANDO, VisitaTecnicaStatus.EM_EXECUCAO],
      },
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
      pedido: {
        select: {
          id: true,
          status: true,
          tipoEspecial: true,
          visitasTecnicas: {
            select: {
              id: true,
              listaExtras: {
                select: { id: true },
              },
            },
          },
        },
      },
      orcamento: {
        select: {
          id: true,
        },
      },
      tecnico: {
        select: { id: true, name: true },
      },
    },
    orderBy: { dataMarcada: "asc" },
  })

  const data = visitas.map((visita) => {
    const diasDesdeMarcacao = differenceInBusinessDays(new Date(), visita.dataMarcada)
    const atrasada =
      (visita.status === VisitaTecnicaStatus.AGUARDANDO || visita.status === VisitaTecnicaStatus.EM_EXECUCAO) &&
      diasDesdeMarcacao > 3

    const visitasDoPedido = visita.pedido?.visitasTecnicas ?? []
    const totalVisitasDoPedido = visitasDoPedido.length
    const isPrimeiraVisita = totalVisitasDoPedido === 1
    const passouPeloSac = visitasDoPedido.some((v) => v.listaExtras.length > 0)

    let tipoVisita: string | null = null
    if (visita.pedido?.tipoEspecial === "OS") {
      tipoVisita = "Ord. Serv."
    } else if (passouPeloSac) {
      tipoVisita = "Passou pelo SAC"
    } else if (isPrimeiraVisita) {
      tipoVisita = "Primeira visita"
    }

    return {
      id: visita.id,
      pedidoId: visita.pedido?.id ?? null,
      pedidoStatus: visita.pedido?.status ?? null,
      orcamentoId: visita.orcamento.id,
      clienteId: visita.cliente.id,
      clienteRazaoSocial: visita.cliente.razaoSocial,
      clienteCnpj: visita.cliente.cnpj,
      endereco: buildEndereco(visita.cliente),
      estado: visita.cliente.estado ?? null,
      cidade: visita.cliente.cidade ?? null,
      dataMarcada: visita.dataMarcada,
      dataRegistroInicio: visita.dataRegistroInicio,
      status: visita.status,
      tecnicoId: visita.tecnico?.id ?? null,
      tecnicoNome: visita.tecnico?.name ?? "Técnico não identificado",
      diasDesdeMarcacao,
      atrasada,
      tipoVisita,
    }
  })

  return {
    data,
    total: data.length,
    alertas: data.filter((visita) => visita.atrasada).length,
  }
}

