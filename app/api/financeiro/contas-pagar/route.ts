import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { parseDateOnlySafe, getNowBrazil, createPeriodRange } from "@/lib/date-utils"

type StatusFilter = "todos" | "a_pagar" | "pago"

const PAGE_SIZE_DEFAULT = 50

// Alias para manter compatibilidade com código existente
const parseDateOnly = parseDateOnlySafe

const parseBrazilDateTime = (value: string | undefined | null) => {
  if (!value) return null
  // se vier só a data, assume meia-noite no fuso -03:00
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00-03:00`)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const deriveStatus = (status: number, vencimento: Date, today: Date) => {
  if (status === 1) return 1
  if (status === 0 && vencimento < today) return -1
  return 0
}

const buildWhere = (params: URLSearchParams, today: Date) => {
  const status = (params.get("status") as StatusFilter | null) ?? "todos"
  const startDate = parseDateOnly(params.get("startDate"))
  const endDate = parseDateOnly(params.get("endDate"))
  const categoria = params.get("categoriaId")

  const where: any = {}

  if (startDate || endDate) {
    where.vencimento = {}
    if (startDate) where.vencimento.gte = startDate
    if (endDate) where.vencimento.lte = endDate
  }

  if (status === "pago") {
    where.status = 1
  } else if (status === "a_pagar") {
    where.status = 0
  }

  if (categoria && categoria !== "all") {
    if (categoria === "sem") {
      where.categoriaId = null
    } else if (!Number.isNaN(Number(categoria))) {
      where.categoriaId = Number(categoria)
    }
  }

  return where
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const params = url.searchParams

  const page = Math.max(1, Number(params.get("page") || 1))
  const pageSize = Math.max(1, Math.min(200, Number(params.get("pageSize") || PAGE_SIZE_DEFAULT)))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const where = buildWhere(params, today)

  try {
    const orderBy =
      (params.get("status") as StatusFilter | null) === "pago"
        ? { pagoEm: "desc" as const }
        : { vencimento: "desc" as const }

    const nowBr = getNowBrazil()
    const { startDate: startMonthBr, endDate: endMonthBr } = createPeriodRange("mes", nowBr.month, nowBr.year)

    const [total, data, allFiltered, totalAPagarResult, totalAPagarMesResult] = await (prisma as any).$transaction([
      (prisma as any).contaPagar.count({ where }),
      (prisma as any).contaPagar.findMany({
        where,
        include: {
          categoria: true,
          comissao: {
            include: {
              pedido: {
                include: { vendedor: true },
              },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      (prisma as any).contaPagar.findMany({
        where,
        include: {
          categoria: true,
          comissao: {
            include: {
              pedido: {
                include: { vendedor: true },
              },
            },
          },
        },
        orderBy,
      }),
      // Total de TODAS as contas com status 0 (a pagar), sem filtros de data
      (prisma as any).contaPagar.aggregate({
        where: { status: 0 },
        _sum: { valor: true },
        _count: true,
      }),
      // Total de contas a pagar NO MÊS ATUAL (Estritamente deste mês)
      (prisma as any).contaPagar.aggregate({
        where: {
          status: 0,
          vencimento: { gte: startMonthBr, lt: endMonthBr },
        },
        _sum: { valor: true },
        _count: true,
      }),
    ])

    const totalAPagar = totalAPagarResult?._sum?.valor ?? 0
    const countAPagar = totalAPagarResult?._count ?? 0
    const totalAPagarMes = totalAPagarMesResult?._sum?.valor ?? 0
    const countAPagarMes = totalAPagarMesResult?._count ?? 0

    let hasOverdue = false
    const byCategoryMap = new Map<number | "sem-categoria", { categoriaId: number | null; nome: string; total: number; itens: any[] }>()
    const buildKey = (catId: number | null) => (catId === null ? "sem-categoria" : catId)

    // Processar agrupamento para a lista GERAL (pode ser diferente do agrupamento por categoria)
    const commissionGroups = new Map<string, any>()
    const processedGeralItems: any[] = []
    let filteredTotal = 0

    const allItemsToProcess = allFiltered as any[]

    allItemsToProcess.forEach((item) => {
      const statusDerivado = deriveStatus(item.status, item.vencimento, today)
      if (statusDerivado === -1) hasOverdue = true
      filteredTotal += item.valor ?? 0

      // Categorização (para a aba de categorias)
      const key = buildKey(item.categoriaId)
      const nome = item.categoria?.nome ?? "Sem categoria"
      const catGroup =
        byCategoryMap.get(key) ??
        ({
          categoriaId: item.categoriaId as number | null,
          nome,
          total: 0,
          itens: [],
        } as { categoriaId: number | null; nome: string; total: number; itens: any[] })

      catGroup.total += item.valor ?? 0
      catGroup.itens.push({
        id: item.id,
        descricao: item.descricao,
        valor: item.valor,
        status: statusDerivado,
        vencimento: item.vencimento,
        pagoEm: item.pagoEm,
        categoriaId: item.categoriaId,
        categoriaNome: nome,
        vendedorNome: item.comissao?.pedido?.vendedor?.fullname || item.comissao?.pedido?.vendedor?.name || null,
        comissaoId: item.comissaoId,
      })
      byCategoryMap.set(key, catGroup)

      // Lógica de agrupamento específico para a lista GERAL
      const sellerName = item.comissao?.pedido?.vendedor?.fullname || item.comissao?.pedido?.vendedor?.name || null
      const isComissao = item.comissaoId || (item.categoria?.nome && item.categoria.nome.toLowerCase().includes("comiss"))

      if (isComissao && sellerName) {
        const groupKey = `comissao-${sellerName}`
        const existingGroup = commissionGroups.get(groupKey)
        if (existingGroup) {
          existingGroup.valor += item.valor
          existingGroup.ids.push(item.id)
          // Mantém o vencimento mais próximo
          if (new Date(item.vencimento) < new Date(existingGroup.vencimento)) {
            existingGroup.vencimento = item.vencimento
          }
        } else {
          commissionGroups.set(groupKey, {
            id: `group-${item.id}`,
            isGroup: true,
            descricao: `Comissões - ${sellerName}`,
            valor: item.valor,
            status: 0, // Geralmente agrupamos apenas as que estão a pagar
            vencimento: item.vencimento,
            pagoEm: null,
            categoriaId: item.categoriaId,
            categoriaNome: "Comissões",
            vendedorNome: sellerName,
            ids: [item.id],
          })
        }
      } else {
        processedGeralItems.push({
          id: item.id,
          descricao: item.descricao,
          valor: item.valor,
          status: statusDerivado,
          vencimento: item.vencimento,
          pagoEm: item.pagoEm,
          categoriaId: item.categoriaId,
          categoriaNome: item.categoria?.nome ?? null,
          vendedorNome: sellerName,
          comissaoId: item.comissaoId,
          isGroup: false,
        })
      }
    })

    // Adicionar grupos processados à lista final
    commissionGroups.forEach((group) => {
      processedGeralItems.push(group)
    })

    // Ordenação da lista final (respeitando o filtro original)
    const isSortByPago = (params.get("status") as StatusFilter | null) === "pago"
    processedGeralItems.sort((a, b) => {
      if (isSortByPago) {
        const dateA = a.pagoEm ? new Date(a.pagoEm).getTime() : 0
        const dateB = b.pagoEm ? new Date(b.pagoEm).getTime() : 0
        return dateB - dateA
      }
      const dateA = new Date(a.vencimento).getTime()
      const dateB = new Date(b.vencimento).getTime()
      return dateB - dateA // Decrescente por padrão no seu código
    })

    const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

    // Paginação manual após processamento
    const totalGrouped = processedGeralItems.length
    const paginatedList = processedGeralItems.slice((page - 1) * pageSize, page * pageSize)

    return NextResponse.json({
      data: paginatedList,
      pagination: {
        total: totalGrouped,
        totalPages: Math.max(1, Math.ceil(totalGrouped / pageSize)),
      },
      filteredTotal,
      hasOverdue,
      byCategory,
      totalAPagar,
      countAPagar,
      totalAPagarMes,
      countAPagarMes,
    })
  } catch (error) {
    console.error("Erro ao listar contas a pagar:", error)
    return NextResponse.json({ error: "Erro ao listar contas a pagar." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { descricao, categoriaId, valor, vencimento } = body ?? {}

    const valorNum = Number(valor)
    if (!valorNum || Number.isNaN(valorNum) || valorNum <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 })
    }

    const vencimentoDate = parseDateOnly(vencimento)
    if (!vencimentoDate) {
      return NextResponse.json({ error: "Vencimento inválido. Use YYYY-MM-DD." }, { status: 400 })
    }

    if (categoriaId) {
      const exists = await (prisma as any).contaPagarCategoria.findUnique({ where: { id: Number(categoriaId) } })
      if (!exists) {
        return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 })
      }
    }

    const created = await (prisma as any).contaPagar.create({
      data: {
        descricao: descricao || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        valor: valorNum,
        vencimento: vencimentoDate,
        status: 0,
      },
      include: { categoria: true },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return NextResponse.json({
      id: created.id,
      descricao: created.descricao,
      valor: created.valor,
      status: deriveStatus(created.status, created.vencimento, today),
      vencimento: created.vencimento,
      pagoEm: created.pagoEm,
      categoriaId: created.categoriaId,
      categoriaNome: created.categoria?.nome ?? null,
    })
  } catch (error) {
    console.error("Erro ao criar conta a pagar:", error)
    return NextResponse.json({ error: "Erro ao criar conta a pagar." }, { status: 500 })
  }
}

