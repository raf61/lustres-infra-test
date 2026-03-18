import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildClientUpdateData, extractAdministradoraId, extractVendedorId, normalizeUltimaManutencaoWithLastOrder } from "@/domain/client/transform"
import { assignVendorToClients, releaseClientFromVendor } from "@/domain/client/vendor-assignment-rules"
import { calcularCategoria } from "@/domain/client/category-rules"

type RouteParams = {
  id?: string
}

type RouteContext = {
  params?: RouteParams | Promise<RouteParams>
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as Promise<unknown>).then === "function"

const toISOString = (value: Date | null): string | null =>
  value ? value.toISOString() : null

type CategoriaDbValue = "ATIVO" | "AGENDADO" | "EXPLORADO" | null

const mapCategoria = (
  categoria: CategoriaDbValue
): "ativo" | "agendado" | "explorado" => {
  switch (categoria) {
    case "ATIVO":
      return "ativo"
    case "AGENDADO":
      return "agendado"
    case "EXPLORADO":
      return "explorado"
    default:
      return "explorado"
  }
}

export async function GET(
  request: Request,
  context: RouteContext = {}
) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id

  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined

    if (!idParam) {
      const segments = url.pathname.split("/").filter(Boolean)
      idParam = segments.at(-1)
    }
  }

  if (!idParam) {
    return NextResponse.json(
      { error: "ID não informado" },
      { status: 400 }
    )
  }

  const clientId = Number.parseInt(idParam, 10)

  if (Number.isNaN(clientId)) {
    return NextResponse.json(
      { error: "ID inválido" },
      { status: 400 }
    )
  }

  try {
    const [client, lastOrderQueryResult, vigenciaQueryResult] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        include: {
          administradora: {
            select: {
              id: true,
              nome: true,
            },
          },
          vendedor: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          kanbanEstado: {
            select: {
              code: true,
            },
          },
        },
      }),
      prisma.$queryRaw<Array<{ createdAt: Date | null }>>`
        SELECT MAX(p."createdAt") AS "createdAt"
        FROM "Pedido" p
        INNER JOIN "Orcamento" o ON o."id" = p."orcamentoId"
        WHERE o."clienteId" = ${clientId}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      `,
      prisma.$queryRaw<Array<{ isContratoVigente: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM "ContratoManutencao" cm
          WHERE cm."clienteId" = ${clientId}
          AND cm.status = 'OK'
          AND cm."dataFim" >= CURRENT_DATE
        ) AS "isContratoVigente"
      `,
    ])

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    const lastOrder = lastOrderQueryResult?.[0]?.createdAt ?? null
    const isContratoVigente = vigenciaQueryResult?.[0]?.isContratoVigente ?? false

    return NextResponse.json({
      id: client.id,
      cnpj: client.cnpj,
      razaoSocial: client.razaoSocial,
      ultimaManutencao: toISOString(client.ultimaManutencao),
      ultimoPedido: toISOString(lastOrder),
      cep: client.cep,
      logradouro: client.logradouro,
      numero: client.numero,
      complemento: client.complemento,
      bairro: client.bairro,
      cidade: client.cidade,
      estado: client.estado,
      telefoneCondominio: client.telefoneCondominio,
      celularCondominio: (client as any).celularCondominio ?? null,
      nomeSindico: client.nomeSindico,
      telefoneSindico: client.telefoneSindico,
      dataInicioMandato: toISOString(client.dataInicioMandato),
      dataFimMandato: toISOString(client.dataFimMandato),
      dataAniversarioSindico: toISOString(client.dataAniversarioSindico),
      emailSindico: client.emailSindico,
      nomePorteiro: client.nomePorteiro,
      telefonePorteiro: client.telefonePorteiro,
      quantidadeSPDA: client.quantidadeSPDA,
      quantidadeAndares: client.quantidadeAndares,
      especificacaoCondominio: client.especificacaoCondominio,
      administradoraStringAntigo: client.administradoraStringAntigo,
      observacao: client.observacao,
      dataContatoAgendado: toISOString(client.dataContatoAgendado),
      administradora: client.administradora
        ? {
          id: client.administradora.id,
          nome:
            client.administradora.nome ??
            client.administradoraStringAntigo ??
            "Não informado",
        }
        : null,
      vendedor: client.vendedor
        ? {
          id: client.vendedor.id,
          name: client.vendedor.name ?? null,
          role: client.vendedor.role ?? null,
        }
        : null,
      categoria: mapCategoria(
        ((client as Record<string, unknown>).categoria ?? null) as CategoriaDbValue
      ),
      kanbanCode: (client as any).kanbanEstado?.code ?? null,
      visivelDashVendedor: client.visivelDashVendedor,
      isContratoVigente,
    })
  } catch (error) {
    console.error(`Erro ao buscar cliente ${clientId}:`, error)
    return NextResponse.json(
      { error: "Erro ao buscar cliente" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  context: RouteContext = {}
) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id

  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined

    if (!idParam) {
      const segments = url.pathname.split("/").filter(Boolean)
      idParam = segments.at(-1)
    }
  }

  if (!idParam) {
    return NextResponse.json(
      { error: "ID não informado" },
      { status: 400 }
    )
  }

  const clientId = Number.parseInt(idParam, 10)

  if (Number.isNaN(clientId)) {
    return NextResponse.json(
      { error: "ID inválido" },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()

    const result = await prisma.$transaction(async (tx) => {
      // Validar que o cliente existe
      const existingClient = await tx.client.findUnique({
        where: { id: clientId },
      })

      if (!existingClient) {
        return { error: "Cliente não encontrado" } as const
      }

      // Preparar dados para atualização usando helper centralizado
      const buildResult = buildClientUpdateData(body)
      if (!buildResult.ok) {
        return { error: buildResult.error.message, status: buildResult.error.status } as const
      }
      const updateData = buildResult.data

      // Relacionamentos (connect/disconnect)
      const adminId = extractAdministradoraId(body)
      if (adminId.shouldUpdate) {
        if (adminId.value) {
          updateData.administradora = { connect: { id: adminId.value } }
        } else {
          updateData.administradora = { disconnect: true }
        }
      }

      // Verificar se o vendedor está sendo alterado (para usar módulo centralizado)
      const vendId = extractVendedorId(body)
      const vendedorAnterior = existingClient.vendedorId
      let vendedorFoiAlterado = false

      // Atualizar cliente (campos exceto vendedor se houver alteração de vendedor)
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: updateData,
        include: {
          administradora: {
            select: {
              id: true,
              nome: true,
            },
          },
          vendedor: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          kanbanEstado: {
            select: {
              code: true,
            },
          },
        },
      })

      // Tratar alteração de vendedor usando módulos centralizados
      if (vendId.shouldUpdate) {
        const novoVendedorId = vendId.value

        if (novoVendedorId && novoVendedorId !== vendedorAnterior) {
          await assignVendorToClients(tx, { clientIds: [clientId], vendedorId: novoVendedorId }, [])
          vendedorFoiAlterado = true
        } else if (!novoVendedorId && vendedorAnterior) {
          await releaseClientFromVendor(tx, clientId, "Remoção manual de vendedor")
          vendedorFoiAlterado = true
        }
      }

      // Se o vendedor foi alterado, buscar cliente atualizado novamente
      const clienteFinal = vendedorFoiAlterado
        ? await tx.client.findUnique({
          where: { id: clientId },
          include: {
            administradora: { select: { id: true, nome: true } },
            vendedor: { select: { id: true, name: true, role: true } },
            kanbanEstado: { select: { code: true } },
          },
        })
        : updatedClient

      if (!clienteFinal) {
        return { error: "Erro ao buscar cliente atualizado" } as const
      }

      // Buscar último pedido e total
      const resultQuery = await tx.$queryRaw<Array<{ createdAt: Date | null, total: bigint }>>`
        SELECT MAX(p."createdAt") AS "createdAt", COUNT(p."id") AS "total"
        FROM "Pedido" p
        INNER JOIN "Orcamento" o ON o."id" = p."orcamentoId"
        WHERE o."clienteId" = ${clientId}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      `

      const lastOrder = resultQuery?.[0]?.createdAt ?? null
      const totalPedidos = Number(resultQuery?.[0]?.total ?? 0)

      // Proteção: se ultimaManutencao foi enviada e está no mesmo dia do último pedido,
      // usar o timestamp exato do pedido (evita perder horário e quebrar categoria)
      let clienteFinalAtualizado = clienteFinal
      if (updateData.ultimaManutencao !== undefined && lastOrder) {
        const normalizedManutencao = normalizeUltimaManutencaoWithLastOrder(
          clienteFinal.ultimaManutencao,
          lastOrder
        )
        if (normalizedManutencao && normalizedManutencao.getTime() !== clienteFinal.ultimaManutencao?.getTime()) {
          clienteFinalAtualizado = await tx.client.update({
            where: { id: clientId },
            data: { ultimaManutencao: normalizedManutencao },
            include: {
              administradora: { select: { id: true, nome: true } },
              vendedor: { select: { id: true, name: true, role: true } },
              kanbanEstado: { select: { code: true } },
            },
          })
        }
      }

      // Recalcular categoria
      const novaCategoria = calcularCategoria({
        ultimoPedidoData: lastOrder,
        ultimaManutencao: clienteFinalAtualizado.ultimaManutencao,
        totalPedidos: totalPedidos
      })

      if (clienteFinalAtualizado.categoria !== novaCategoria) {
        clienteFinalAtualizado = await tx.client.update({
          where: { id: clientId },
          data: { categoria: novaCategoria },
          include: {
            administradora: { select: { id: true, nome: true } },
            vendedor: { select: { id: true, name: true, role: true } },
            kanbanEstado: { select: { code: true } },
          },
        })
      }

      return { clienteFinal: clienteFinalAtualizado, lastOrder } as const
    })

    if ("error" in result) {
      const status = (result as any).status ?? (result.error === "Cliente não encontrado" ? 404 : 500)
      return NextResponse.json({ error: result.error }, { status })
    }

    const { clienteFinal, lastOrder } = result

    return NextResponse.json({
      id: clienteFinal.id,
      cnpj: clienteFinal.cnpj,
      razaoSocial: clienteFinal.razaoSocial,
      ultimaManutencao: toISOString(clienteFinal.ultimaManutencao),
      ultimoPedido: toISOString(lastOrder),
      cep: clienteFinal.cep,
      logradouro: clienteFinal.logradouro,
      numero: clienteFinal.numero,
      complemento: clienteFinal.complemento,
      bairro: clienteFinal.bairro,
      cidade: clienteFinal.cidade,
      estado: clienteFinal.estado,
      telefoneCondominio: clienteFinal.telefoneCondominio,
      celularCondominio: (clienteFinal as any).celularCondominio ?? null,
      nomeSindico: clienteFinal.nomeSindico,
      telefoneSindico: clienteFinal.telefoneSindico,
      dataInicioMandato: toISOString(clienteFinal.dataInicioMandato),
      dataFimMandato: toISOString(clienteFinal.dataFimMandato),
      dataAniversarioSindico: toISOString(clienteFinal.dataAniversarioSindico),
      emailSindico: clienteFinal.emailSindico,
      nomePorteiro: clienteFinal.nomePorteiro,
      telefonePorteiro: clienteFinal.telefonePorteiro,
      quantidadeSPDA: clienteFinal.quantidadeSPDA,
      quantidadeAndares: clienteFinal.quantidadeAndares,
      especificacaoCondominio: clienteFinal.especificacaoCondominio,
      administradoraStringAntigo: clienteFinal.administradoraStringAntigo,
      observacao: clienteFinal.observacao,
      dataContatoAgendado: toISOString(clienteFinal.dataContatoAgendado),
      administradora: clienteFinal.administradora
        ? {
          id: clienteFinal.administradora.id,
          nome:
            clienteFinal.administradora.nome ??
            clienteFinal.administradoraStringAntigo ??
            "Não informado",
        }
        : null,
      vendedor: clienteFinal.vendedor
        ? {
          id: clienteFinal.vendedor.id,
          name: clienteFinal.vendedor.name ?? null,
          role: clienteFinal.vendedor.role ?? null,
        }
        : null,
      categoria: mapCategoria(
        ((clienteFinal as Record<string, unknown>).categoria ?? null) as CategoriaDbValue
      ),
      kanbanCode: (clienteFinal as any).kanbanEstado?.code ?? null,
      visivelDashVendedor: clienteFinal.visivelDashVendedor,
    })
  } catch (error) {
    console.error(`Erro ao atualizar cliente ${clientId}:`, error)
    return NextResponse.json(
      { error: "Erro ao atualizar cliente" },
      { status: 500 }
    )
  }
}


