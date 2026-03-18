import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma, PedidoStatus } from "@prisma/client"
import { startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from "date-fns"

// =============================================================================
// TIPOS E CONSTANTES
// =============================================================================

const STATUS_VALIDOS: PedidoStatus[] = [
  PedidoStatus.AGUARDANDO,
  PedidoStatus.AGENDADO,
  PedidoStatus.EXECUCAO,
  PedidoStatus.CONCLUIDO,
  PedidoStatus.SAC,
  PedidoStatus.AGUARDANDO_APROVACAO_SUPERVISAO,
  PedidoStatus.AGUARDANDO_APROVACAO_FINAL,
  PedidoStatus.ANALISE_CANCELAMENTO,
  PedidoStatus.ANALISE_CANCELAMENTO_SUPERVISAO,
]

const PEDIDO_STATUS_VALIDOS_SQL = Prisma.sql`ARRAY[${Prisma.join(STATUS_VALIDOS.map(s => Prisma.sql`${s}::"PedidoStatus"`))}]`

// =============================================================================
// GET /api/relatorio
// =============================================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get("ano") ? parseInt(searchParams.get("ano")!) : new Date().getFullYear()
    const mes = searchParams.get("mes") ? parseInt(searchParams.get("mes")!) : null
    const trimestre = searchParams.get("trimestre") ? parseInt(searchParams.get("trimestre")!) : null
    const estado = searchParams.get("estado") && searchParams.get("estado") !== "todos" ? searchParams.get("estado")! : null
    const vendedorId = searchParams.get("vendedorId") && searchParams.get("vendedorId") !== "todos" ? searchParams.get("vendedorId")! : null
    const periodicity = searchParams.get("periodicity") || "ano"

    // 1. Definir o range de datas
    let startDate: Date
    let endDate: Date

    if (periodicity === "mes" && mes) {
      startDate = startOfMonth(new Date(ano, mes - 1))
      endDate = endOfMonth(new Date(ano, mes - 1))
    } else if (periodicity === "trimestre" && trimestre) {
      const monthStart = (trimestre - 1) * 3
      startDate = startOfQuarter(new Date(ano, monthStart))
      endDate = endOfQuarter(new Date(ano, monthStart))
    } else if (periodicity === "ano") {
      startDate = startOfYear(new Date(ano, 0))
      endDate = endOfYear(new Date(ano, 0))
    } else {
      startDate = new Date(2000, 0, 1)
      endDate = new Date(2099, 11, 31)
    }

    const baseWhere = Prisma.sql`
      p."createdAt" >= ${startDate} AND p."createdAt" <= ${endDate}
      AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
      AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
      ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
    `

    // =========================================================================
    // MÉTRICAS GERAIS
    // =========================================================================

    const billingResult = await prisma.$queryRaw<{ total: number; count: number; avgValue: number }[]>`
      SELECT 
        COALESCE(SUM(pi."valorUnitarioPraticado" * pi.quantidade), 0)::float as total,
        COUNT(DISTINCT p.id)::int as count,
        COALESCE(AVG(sub.pedido_total), 0)::float as "avgValue"
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      LEFT JOIN "Client" c ON c.id = p."clienteId"
      LEFT JOIN LATERAL (
        SELECT SUM(pi2."valorUnitarioPraticado" * pi2.quantidade) as pedido_total
        FROM "PedidoItem" pi2
        WHERE pi2."pedidoId" = p.id
      ) sub ON true
      WHERE ${baseWhere}
    `

    const neverAttendedResult = await prisma.client.count({
      where: {
        pedidos: { none: {} },
        ...(vendedorId ? { vendedorId } : {})
      }
    })

    const totalBudgetsResult = await prisma.orcamento.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(estado ? { cliente: { estado } } : {}),
        ...(vendedorId ? { vendedorId } : {})
      }
    })

    const summary = {
      revenue: billingResult[0]?.total || 0,
      orderCount: billingResult[0]?.count || 0,
      avgOrderValue: billingResult[0]?.avgValue || 0,
      neverAttended: neverAttendedResult,
      totalBudgets: totalBudgetsResult
    }

    // =========================================================================
    // COHORT E CHURN (RAIO 3 MESES)
    // =========================================================================

    const clientsInPeriodResult = await prisma.$queryRaw<{ clienteId: number }[]>`
      SELECT DISTINCT p."clienteId"
      FROM "Pedido" p
      LEFT JOIN "Client" c ON c.id = p."clienteId"
      WHERE ${baseWhere}
    `
    const clientIdsInPeriod = clientsInPeriodResult.map(r => r.clienteId)

    const newClientsResult = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT p."clienteId")::int as count
      FROM "Pedido" p
      LEFT JOIN "Client" c ON c.id = p."clienteId"
      WHERE ${baseWhere}
      AND p."clienteId" NOT IN (
        SELECT DISTINCT p2."clienteId"
        FROM "Pedido" p2
        WHERE p2."createdAt" < ${startDate}
        AND p2.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
        AND (p2."tipoEspecial" IS NULL OR p2."tipoEspecial" != 'OS')
      )
    `

    const repeatClientsResult = await prisma.$queryRaw<{ count: number }[]>`
       SELECT COUNT(DISTINCT p."clienteId")::int as count
       FROM "Pedido" p
       LEFT JOIN "Client" c ON c.id = p."clienteId"
       WHERE ${baseWhere}
       AND p."clienteId" IN (
         SELECT DISTINCT p2."clienteId"
         FROM "Pedido" p2
         WHERE p2."createdAt" < ${startDate}
         AND p2.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
         AND (p2."tipoEspecial" IS NULL OR p2."tipoEspecial" != 'OS')
       )
    `

    const prevYearStart = subMonths(startDate, 12)
    const prevYearEnd = subMonths(endDate, 12)

    // Churn Rule: No order in target period AND no order in expectedDate +/- 3 months
    const lostClientsResult = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT p."clienteId")::int as count
      FROM "Pedido" p
      LEFT JOIN "Client" c ON c.id = p."clienteId"
      WHERE p."createdAt" >= ${prevYearStart} AND p."createdAt" <= ${prevYearEnd}
        AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
        ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
        ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
        AND p."clienteId" NOT IN (
          SELECT DISTINCT p2."clienteId"
          FROM "Pedido" p2
          WHERE p2."createdAt" >= ${startDate} AND p2."createdAt" <= ${endDate}
          AND p2.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
          AND (p2."tipoEspecial" IS NULL OR p2."tipoEspecial" != 'OS')
        )
        AND p."clienteId" NOT IN (
          SELECT DISTINCT p3."clienteId"
          FROM "Pedido" p3
          WHERE p3."createdAt" >= (p."createdAt" + interval '9 months')
            AND p3."createdAt" <= (p."createdAt" + interval '15 months')
            AND p3.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
            AND (p3."tipoEspecial" IS NULL OR p3."tipoEspecial" != 'OS')
        )
    `

    const cohorts = {
      new: newClientsResult[0]?.count || 0,
      repeat: repeatClientsResult[0]?.count || 0,
      lost: lostClientsResult[0]?.count || 0,
      active: clientIdsInPeriod.length
    }

    const budgetsOnlyResult = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT o.id)::int as count
      FROM "Orcamento" o
      LEFT JOIN "Client" c ON c.id = o."clienteId"
      WHERE o."createdAt" >= ${startDate} AND o."createdAt" <= ${endDate}
      ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
      ${vendedorId ? Prisma.sql`AND o."vendedorId" = ${vendedorId}` : Prisma.empty}
      AND NOT EXISTS (
        SELECT 1 FROM "Pedido" p WHERE p."orcamentoId" = o.id
      )
    `

    // =========================================================================
    // TIMELINE
    // =========================================================================

    let timeline: any[] = []
    if (periodicity === "ano" || periodicity === "todos" || periodicity === "mes") {
      let datePart = Prisma.sql`to_char(p."createdAt", 'YYYY')`;
      let oDatePart = Prisma.sql`to_char(o."createdAt", 'YYYY')`;
      if (periodicity === "ano") {
        datePart = Prisma.sql`to_char(p."createdAt", 'MM/YYYY')`;
        oDatePart = Prisma.sql`to_char(o."createdAt", 'MM/YYYY')`;
      }
      if (periodicity === "mes") {
        datePart = Prisma.sql`to_char(p."createdAt", 'DD/MM/YYYY')`;
        oDatePart = Prisma.sql`to_char(o."createdAt", 'DD/MM/YYYY')`;
      }

      const ordersResult = await prisma.$queryRaw<{ label: string; revenue: number; orders: number }[]>`
        SELECT ${datePart} as label, SUM(pi."valorUnitarioPraticado" * pi.quantidade)::float as revenue, COUNT(DISTINCT p.id)::int as orders
        FROM "Pedido" p
        LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
        LEFT JOIN "Client" c ON c.id = p."clienteId"
        WHERE p."createdAt" >= ${startDate} AND p."createdAt" <= ${endDate}
          AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
          AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
          ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
          ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
        GROUP BY label
      `

      const budgetsResult = await prisma.$queryRaw<{ label: string; budgets: number }[]>`
        SELECT ${oDatePart} as label, COUNT(DISTINCT o.id)::int as budgets
        FROM "Orcamento" o
        LEFT JOIN "Client" c ON c.id = o."clienteId"
        WHERE o."createdAt" >= ${startDate} AND o."createdAt" <= ${endDate}
          ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
          ${vendedorId ? Prisma.sql`AND o."vendedorId" = ${vendedorId}` : Prisma.empty}
        GROUP BY label
      `

      let churnResult: { label: string; churn: number }[] = []
      if (periodicity === "ano") {
        churnResult = await prisma.$queryRaw<{ label: string; churn: number }[]>`
          SELECT to_char(p."createdAt" + interval '1 year', 'MM/YYYY') as label, COUNT(DISTINCT p."clienteId")::int as churn
          FROM "Pedido" p
          LEFT JOIN "Client" c ON c.id = p."clienteId"
          WHERE p."createdAt" >= ${prevYearStart} AND p."createdAt" <= ${prevYearEnd}
            AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
            ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
            ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
            AND p."clienteId" NOT IN (
              SELECT DISTINCT p2."clienteId" 
              FROM "Pedido" p2 
              WHERE p2."createdAt" >= ${startDate} AND p2."createdAt" <= ${endDate}
              AND (p2."tipoEspecial" IS NULL OR p2."tipoEspecial" != 'OS')
            )
            AND p."clienteId" NOT IN (
              SELECT DISTINCT p3."clienteId" FROM "Pedido" p3 
              WHERE p3."createdAt" >= (p."createdAt" + interval '9 months') AND p3."createdAt" <= (p."createdAt" + interval '15 months')
              AND (p3."tipoEspecial" IS NULL OR p3."tipoEspecial" != 'OS')
            )
          GROUP BY label
        `
      }

      const map = new Map<string, any>()
      const addToMap = (data: any[], key: string) => {
        data.forEach(item => {
          const entry = map.get(item.label) || { label: item.label, revenue: 0, orders: 0, budgets: 0, churn: 0 }
          entry[key] = item[key]
          if (item.revenue) entry.revenue = item.revenue
          map.set(item.label, entry)
        })
      }
      addToMap(ordersResult, 'orders')
      addToMap(budgetsResult, 'budgets')
      addToMap(churnResult, 'churn')

      timeline = Array.from(map.values()).sort((a, b) => {
        if (periodicity === "mes") {
          const [d1, m1, y1] = a.label.split('/').map(Number); const [d2, m2, y2] = b.label.split('/').map(Number)
          return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime()
        }
        if (periodicity === "ano") {
          const [m1, y1] = a.label.split('/').map(Number); const [m2, y2] = b.label.split('/').map(Number)
          return new Date(y1, m1 - 1, 1).getTime() - new Date(y2, m2 - 1, 1).getTime()
        }
        return a.label.localeCompare(b.label)
      })
    }

    // =========================================================================
    // DISTRIBUIÇÃO ESTADO (DYNAMICA)
    // =========================================================================

    const stateRevResult = await prisma.$queryRaw<{ estado: string; revenue: number; orders: number }[]>`
      SELECT COALESCE(c.estado, 'N/I') as estado, SUM(pi."valorUnitarioPraticado" * pi.quantidade)::float as revenue, COUNT(DISTINCT p.id)::int as orders
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      LEFT JOIN "Client" c ON c.id = p."clienteId"
      WHERE ${baseWhere} GROUP BY estado
    `
    const stateBudResult = await prisma.$queryRaw<{ estado: string; budgets: number }[]>`
      SELECT COALESCE(c.estado, 'N/I') as estado, COUNT(DISTINCT o.id)::int as budgets
      FROM "Orcamento" o LEFT JOIN "Client" c ON c.id = o."clienteId"
      WHERE o."createdAt" >= ${startDate} AND o."createdAt" <= ${endDate}
      ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
      ${vendedorId ? Prisma.sql`AND o."vendedorId" = ${vendedorId}` : Prisma.empty}
      GROUP BY estado
    `
    const stateChResult = await prisma.$queryRaw<{ estado: string; churn: number }[]>`
      SELECT COALESCE(c.estado, 'N/I') as estado, COUNT(DISTINCT p."clienteId")::int as churn
      FROM "Pedido" p LEFT JOIN "Client" c ON c.id = p."clienteId"
      WHERE p."createdAt" >= ${prevYearStart} AND p."createdAt" <= ${prevYearEnd}
        AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
        ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
        ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
        AND p."clienteId" NOT IN (SELECT p2."clienteId" FROM "Pedido" p2 WHERE p2."createdAt" >= ${startDate} AND p2."createdAt" <= ${endDate} AND (p2."tipoEspecial" IS NULL OR p2."tipoEspecial" != 'OS'))
        AND p."clienteId" NOT IN (SELECT p3."clienteId" FROM "Pedido" p3 WHERE p3."createdAt" >= (p."createdAt" + interval '9 months') AND p3."createdAt" <= (p."createdAt" + interval '15 months') AND (p3."tipoEspecial" IS NULL OR p3."tipoEspecial" != 'OS'))
      GROUP BY estado
    `

    // =========================================================================
    // COMPARATIVO VENDEDORES (DYNAMICA)
    // =========================================================================

    // Para o comparativo, ignoramos o filtro de vendedor individual se houver, 
    // mas mantemos os outros filtros (data, estado)
    const baseWhereNoSeller = Prisma.sql`
      p."createdAt" >= ${startDate} AND p."createdAt" <= ${endDate}
      AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
      AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
    `

    const sellerRevResult = await prisma.$queryRaw<{ vendedorId: string; name: string; revenue: number; orders: number }[]>`
      SELECT 
        p."vendedorId", 
        COALESCE(u.fullname, u.name, 'Sem Vendedor') as name,
        SUM(pi."valorUnitarioPraticado" * pi.quantidade)::float as revenue, 
        COUNT(DISTINCT p.id)::int as orders
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      LEFT JOIN "Client" c ON c.id = p."clienteId"
      LEFT JOIN "User" u ON u.id = p."vendedorId"
      WHERE ${baseWhereNoSeller}
      GROUP BY p."vendedorId", u.fullname, u.name
    `

    const sellerBudResult = await prisma.$queryRaw<{ vendedorId: string; budgets: number }[]>`
      SELECT o."vendedorId", COUNT(DISTINCT o.id)::int as budgets
      FROM "Orcamento" o
      LEFT JOIN "Client" c ON c.id = o."clienteId"
      WHERE o."createdAt" >= ${startDate} AND o."createdAt" <= ${endDate}
      ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
      GROUP BY o."vendedorId"
    `

    const sellerChResult = await prisma.$queryRaw<{ vendedorId: string; churn: number }[]>`
      SELECT p."vendedorId", COUNT(DISTINCT p."clienteId")::int as churn
      FROM "Pedido" p
      LEFT JOIN "Client" c ON c.id = p."clienteId"
      WHERE p."createdAt" >= ${prevYearStart} AND p."createdAt" <= ${prevYearEnd}
        AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
        ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
        AND p."clienteId" NOT IN (SELECT p2."clienteId" FROM "Pedido" p2 WHERE p2."createdAt" >= ${startDate} AND p2."createdAt" <= ${endDate} AND (p2."tipoEspecial" IS NULL OR p2."tipoEspecial" != 'OS'))
        AND p."clienteId" NOT IN (SELECT p3."clienteId" FROM "Pedido" p3 WHERE p3."createdAt" >= (p."createdAt" + interval '9 months') AND p3."createdAt" <= (p."createdAt" + interval '15 months') AND (p3."tipoEspecial" IS NULL OR p3."tipoEspecial" != 'OS'))
      GROUP BY p."vendedorId"
    `

    const sellerMap = new Map<string, any>()
    sellerRevResult.forEach(r => sellerMap.set(r.vendedorId || 'null', { ...r, budgets: 0, churn: 0 }))
    sellerBudResult.forEach(r => {
      const entry = sellerMap.get(r.vendedorId || 'null') || { vendedorId: r.vendedorId, name: 'Sem Vendedor', revenue: 0, orders: 0, budgets: 0, churn: 0 }
      entry.budgets = r.budgets; sellerMap.set(r.vendedorId || 'null', entry)
    })
    sellerChResult.forEach(r => {
      const entry = sellerMap.get(r.vendedorId || 'null') || { vendedorId: r.vendedorId, name: 'Sem Vendedor', revenue: 0, orders: 0, budgets: 0, churn: 0 }
      entry.churn = r.churn; sellerMap.set(r.vendedorId || 'null', entry)
    })
    const sellerDistribution = Array.from(sellerMap.values()).sort((a, b) => b.revenue - a.revenue)

    const stateMap = new Map<string, any>()
    stateRevResult.forEach(r => stateMap.set(r.estado, { ...r, budgets: 0, churn: 0 }))
    stateBudResult.forEach(r => {
      const entry = stateMap.get(r.estado) || { estado: r.estado, revenue: 0, orders: 0, budgets: 0, churn: 0 }
      entry.budgets = r.budgets; stateMap.set(r.estado, entry)
    })
    stateChResult.forEach(r => {
      const entry = stateMap.get(r.estado) || { estado: r.estado, revenue: 0, orders: 0, budgets: 0, churn: 0 }
      entry.churn = r.churn; stateMap.set(r.estado, entry)
    })
    const stateDistribution = Array.from(stateMap.values()).sort((a, b) => b.revenue - a.revenue)

    const anosDisponiveisResult = await prisma.$queryRaw<{ ano: number }[]>`SELECT DISTINCT EXTRACT(YEAR FROM "createdAt")::int as ano FROM "Pedido" ORDER BY ano DESC`
    const estadosDisponiveisResult = await prisma.$queryRaw<{ estado: string }[]>`SELECT DISTINCT estado FROM "Client" WHERE estado IS NOT NULL AND estado != '' ORDER BY estado`
    const vendedoresResult = await prisma.user.findMany({
      where: { role: { in: ['VENDEDOR', 'ADMINISTRADOR', 'MASTER', 'SUPERVISOR'] }, active: true },
      select: { id: true, name: true, fullname: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      summary, cohorts, budgetsOnly: budgetsOnlyResult[0]?.count || 0, timeline, stateDistribution, sellerDistribution,
      filters: {
        years: anosDisponiveisResult.map(r => r.ano),
        states: estadosDisponiveisResult.map(r => r.estado),
        sellers: vendedoresResult.map(v => ({ id: v.id, name: v.fullname || v.name }))
      }
    })
  } catch (error) {
    console.error("Erro ao gerar relatório:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 })
  }
}
