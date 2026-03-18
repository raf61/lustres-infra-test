import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
// Nota: endpoints de escrita usam getLoggedUserId, endpoints de leitura podem usar impersonation
import { updateClientCategory } from "@/lib/calculate-client-category"
import { buildClientUpdateData, normalizeUltimaManutencaoWithLastOrder } from "@/domain/client/transform"

type RouteParams = {
  id?: string
}

type RouteContext = {
  params?: RouteParams | Promise<RouteParams>
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof (value as Promise<unknown>).then === "function"

const toISOString = (value: Date | null): string | null => (value ? value.toISOString() : null)

type CategoriaDbValue = "ATIVO" | "AGENDADO" | "EXPLORADO" | null

const mapCategoria = (categoria: CategoriaDbValue): "ativo" | "agendado" | "explorado" => {
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

export async function GET(request: Request, context: RouteContext = {}) {
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
    return NextResponse.json({ error: "ID não informado" }, { status: 400 })
  }

  const clientId = Number.parseInt(idParam, 10)
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  try {
    const [client, lastOrderDate] = await Promise.all([
      prisma.client.findFirst({
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
        AND p.status != 'CANCELADO'
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      `,
    ])

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    const lastOrder = lastOrderDate?.[0]?.createdAt ?? null

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
      dataFimMandato: toISOString(client.dataFimMandato),
      dataAniversarioSindico: toISOString(client.dataAniversarioSindico),
      dataInicioMandato: toISOString(client.dataInicioMandato),
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
          nome: client.administradora.nome ?? client.administradoraStringAntigo ?? "Não informado",
        }
        : null,
      vendedor: client.vendedor
        ? {
          id: client.vendedor.id,
          name: client.vendedor.name ?? null,
          role: client.vendedor.role ?? null,
        }
        : null,
      categoria: mapCategoria(((client as Record<string, unknown>).categoria ?? null) as CategoriaDbValue),
      kanbanCode: (client as any).kanbanEstado?.code ?? null,
      visivelDashVendedor: client.visivelDashVendedor,
    })
  } catch (error) {
    console.error(`Erro ao buscar cliente ${clientId}:`, error)
    return NextResponse.json({ error: "Erro ao buscar cliente" }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext = {}) {
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
    return NextResponse.json({ error: "ID não informado" }, { status: 400 })
  }

  const clientId = Number.parseInt(idParam, 10)
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  try {
    const body = await request.json()

    const result = await prisma.$transaction(async (tx) => {
      // Preparar dados para atualização usando helper centralizado
      const buildResult = buildClientUpdateData(body)
      if (!buildResult.ok) {
        return { error: buildResult.error.message, status: buildResult.error.status } as const
      }
      const updateData = buildResult.data

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
              name: true,
              role: true,
            },
          },
        },
      })

      const lastOrderResult = await tx.$queryRaw<Array<{ createdAt: Date | null }>>`
        SELECT MAX(p."createdAt") AS "createdAt"
        FROM "Pedido" p
        INNER JOIN "Orcamento" o ON o."id" = p."orcamentoId"
        WHERE o."clienteId" = ${clientId}
        AND p.status != 'CANCELADO'
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      `
      const lastOrder = lastOrderResult?.[0]?.createdAt ?? null

      // Proteção: se ultimaManutencao foi enviada e está no mesmo dia do último pedido,
      // usar o timestamp exato do pedido (evita perder horário e quebrar categoria)
      if (updateData.ultimaManutencao !== undefined && lastOrder) {
        const normalizedManutencao = normalizeUltimaManutencaoWithLastOrder(
          updatedClient.ultimaManutencao,
          lastOrder
        )
        if (normalizedManutencao && normalizedManutencao !== updatedClient.ultimaManutencao) {
          await tx.client.update({
            where: { id: clientId },
            data: { ultimaManutencao: normalizedManutencao },
          })
        }
      }

      await updateClientCategory(clientId, tx)
      const categoriaPromise = tx.client.findUnique({
        where: { id: clientId },
        select: { categoria: true },
      })

      const categoriaAtualizada = await categoriaPromise

      return { updatedClient, lastOrder, categoriaAtualizada } as const
    })

    if ("error" in result) {
      const status = (result as any).status ?? 400
      return NextResponse.json({ error: result.error }, { status })
    }

    const { updatedClient, lastOrder, categoriaAtualizada } = result

    return NextResponse.json({
      id: updatedClient.id,
      cnpj: updatedClient.cnpj,
      razaoSocial: updatedClient.razaoSocial,
      ultimaManutencao: toISOString(updatedClient.ultimaManutencao),
      ultimoPedido: toISOString(lastOrder),
      cep: updatedClient.cep,
      logradouro: updatedClient.logradouro,
      numero: updatedClient.numero,
      complemento: updatedClient.complemento,
      bairro: updatedClient.bairro,
      cidade: updatedClient.cidade,
      estado: updatedClient.estado,
      telefoneCondominio: updatedClient.telefoneCondominio,
      celularCondominio: (updatedClient as any).celularCondominio ?? null,
      nomeSindico: updatedClient.nomeSindico,
      telefoneSindico: updatedClient.telefoneSindico,
      dataFimMandato: toISOString(updatedClient.dataFimMandato),
      dataAniversarioSindico: toISOString(updatedClient.dataAniversarioSindico),
      dataInicioMandato: toISOString(updatedClient.dataInicioMandato),
      emailSindico: updatedClient.emailSindico,
      nomePorteiro: updatedClient.nomePorteiro,
      telefonePorteiro: updatedClient.telefonePorteiro,
      quantidadeSPDA: updatedClient.quantidadeSPDA,
      quantidadeAndares: updatedClient.quantidadeAndares,
      especificacaoCondominio: updatedClient.especificacaoCondominio,
      administradoraStringAntigo: updatedClient.administradoraStringAntigo,
      observacao: updatedClient.observacao,
      dataContatoAgendado: toISOString(updatedClient.dataContatoAgendado),
      administradora: updatedClient.administradora
        ? {
          id: updatedClient.administradora.id,
          nome: updatedClient.administradora.nome ?? updatedClient.administradoraStringAntigo ?? "Não informado",
        }
        : null,
      vendedor: updatedClient.vendedor
        ? {
          name: updatedClient.vendedor.name ?? null,
          role: updatedClient.vendedor.role ?? null,
        }
        : null,
      categoria: mapCategoria(((categoriaAtualizada?.categoria ?? null) as CategoriaDbValue) ?? null),
    })
  } catch (error) {
    console.error(`Erro ao atualizar cliente ${clientId}:`, error)
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 })
  }
}

