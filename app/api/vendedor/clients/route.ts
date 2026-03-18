import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getVendedorContext } from "@/lib/vendor-dashboard"

const ACCENTED_CHARS = "ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ"
const UNACCENTED_CHARS = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn"

type TabKey = "agendados" | "ativos" | "explorados" | "pesquisa" | "agenda_all"
type CategoriaDbValue = "ATIVO" | "AGENDADO" | "EXPLORADO" | null

const categoriaEnumSqlMap: Record<Exclude<CategoriaDbValue, null>, Prisma.Sql> = {
  ATIVO: Prisma.sql`'ATIVO'::"ClientCategoria"`,
  AGENDADO: Prisma.sql`'AGENDADO'::"ClientCategoria"`,
  EXPLORADO: Prisma.sql`'EXPLORADO'::"ClientCategoria"`,
}
const categoriaEnumList = [categoriaEnumSqlMap.ATIVO, categoriaEnumSqlMap.AGENDADO, categoriaEnumSqlMap.EXPLORADO]
const clientExploradoCondition = Prisma.sql`(c."categoria" IS NULL OR c."categoria" NOT IN (${categoriaEnumSqlMap.ATIVO}, ${categoriaEnumSqlMap.AGENDADO}))`

const sanitizeText = (value: string | null | undefined) => value?.trim() ?? ""
const sanitizeDigits = (value: string | null | undefined) => value?.replace(/\D/g, "").trim() ?? ""

const normalizeForComparison = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const escapeLikePattern = (value: string) => value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
const normalizeColumn = (column: Prisma.Sql) =>
  Prisma.sql`translate(lower(${column}), ${ACCENTED_CHARS}, ${UNACCENTED_CHARS})`
const buildLikeCondition = (column: Prisma.Sql, pattern: string) =>
  Prisma.sql`${normalizeColumn(column)} LIKE ${pattern} ESCAPE '\\'`

const toMonthNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) || parsed < 1 || parsed > 12 ? null : parsed
}

const toYearNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) || parsed < 2000 || parsed > 2100 ? null : parsed
}

const addMonths = (date: Date, months: number) => {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

const buildSearchConditions = (params: URLSearchParams, vendedorId: string, isMaster: boolean, isImpersonating: boolean): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []

  // Filtragem por vendedor:
  // - Impersonando OU vendedor normal → mostra só os clientes do vendedor específico
  // - Master sem impersonar → mostra TODOS que têm vendedorId settado (não nulos)
  if (!isMaster || isImpersonating) {
    conditions.push(Prisma.sql`c."vendedorId" = ${vendedorId}`)
  } else {
    // Master sem impersonar — todos os que têm um vendedorId atribuído
    conditions.push(Prisma.sql`c."vendedorId" IS NOT NULL`)
  }

  const cnpj = sanitizeDigits(params.get("cnpj"))
  if (cnpj.length > 0) {
    const cnpjConditions = [
      Prisma.sql`regexp_replace(coalesce(c."cnpj", ''), '\\D', '', 'g') = ${cnpj}`,
      Prisma.sql`c."cnpj" ILIKE ${cnpj}`,
    ]
    if (cnpj.length === 14) {
      const formatted = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      cnpjConditions.push(Prisma.sql`c."cnpj" ILIKE ${formatted}`)
    }
    conditions.push(Prisma.sql`(${Prisma.join(cnpjConditions, " OR ")})`)
  }

  const searchTerm = sanitizeText(params.get("search"))
  const normalizedSearch = normalizeForComparison(searchTerm)
  if (normalizedSearch.length > 0) {
    const pattern = `%${escapeLikePattern(normalizedSearch)}%`
    const searchableColumns = [
      Prisma.sql`coalesce(c."razaoSocial", '')`,
      Prisma.sql`coalesce(c."logradouro", '')`,
      Prisma.sql`coalesce(c."cidade", '')`,
      Prisma.sql`coalesce(c."bairro", '')`,
      Prisma.sql`coalesce(c."estado", '')`,
      Prisma.sql`coalesce(c."nomeSindico", '')`,
    ]
    const orFilters = searchableColumns.map((column) => buildLikeCondition(column, pattern))

    // Busca por email (contains simples, sem tratamento)
    const emailPattern = `%${escapeLikePattern(searchTerm)}%`
    orFilters.push(Prisma.sql`coalesce(c."emailSindico", '') ILIKE ${emailPattern}`)

    // Busca por telefone (remove caracteres não-numéricos para comparação)
    const numericSearch = searchTerm.replace(/\D/g, "")
    if (numericSearch.length >= 3) {
      orFilters.push(
        Prisma.sql`regexp_replace(coalesce(c."cnpj", ''), '\\D', '', 'g') ILIKE ${`%${numericSearch}%`}`,
        Prisma.sql`regexp_replace(coalesce(c."telefoneCondominio", ''), '\\D', '', 'g') ILIKE ${`%${numericSearch}%`}`,
        Prisma.sql`regexp_replace(coalesce(c."celularCondominio", ''), '\\D', '', 'g') ILIKE ${`%${numericSearch}%`}`,
        Prisma.sql`regexp_replace(coalesce(c."telefoneSindico", ''), '\\D', '', 'g') ILIKE ${`%${numericSearch}%`}`,
        Prisma.sql`regexp_replace(coalesce(c."telefonePorteiro", ''), '\\D', '', 'g') ILIKE ${`%${numericSearch}%`}`,
      )
    }
    conditions.push(Prisma.sql`(${Prisma.join(orFilters, " OR ")})`)
  }

  const estado = sanitizeText(params.get("estado"))
  if (estado && estado !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(c."estado", '')`)} = ${normalizeForComparison(estado)}`,
    )
  }

  const cidade = sanitizeText(params.get("cidade"))
  if (cidade && cidade !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(c."cidade", '')`)} = ${normalizeForComparison(cidade)}`,
    )
  }

  const bairro = sanitizeText(params.get("bairro"))
  if (bairro.length > 0) {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(c."bairro", '')`)} = ${normalizeForComparison(bairro)}`,
    )
  }

  return conditions
}

const buildFichaSearchConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []

  const cnpj = sanitizeDigits(params.get("cnpj"))
  if (cnpj.length > 0) {
    const cnpjConditions = [
      Prisma.sql`regexp_replace(coalesce(f."cnpj", ''), '\\D', '', 'g') = ${cnpj}`,
      Prisma.sql`f."cnpj" ILIKE ${cnpj}`,
    ]
    if (cnpj.length === 14) {
      const formatted = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      cnpjConditions.push(Prisma.sql`f."cnpj" ILIKE ${formatted}`)
    }
    conditions.push(Prisma.sql`(${Prisma.join(cnpjConditions, " OR ")})`)
  }

  const searchTerm = sanitizeText(params.get("search"))
  const normalizedSearch = normalizeForComparison(searchTerm)
  if (normalizedSearch.length > 0) {
    const pattern = `%${escapeLikePattern(normalizedSearch)}%`
    const searchableColumns = [
      Prisma.sql`coalesce(f."razaoSocial", '')`,
      Prisma.sql`coalesce(f."logradouro", '')`,
      Prisma.sql`coalesce(f."cidade", '')`,
      Prisma.sql`coalesce(f."bairro", '')`,
      Prisma.sql`coalesce(f."estado", '')`,
    ]
    const orFilters = searchableColumns.map((column) => buildLikeCondition(column, pattern))
    const numericSearch = searchTerm.replace(/\D/g, "")
    if (numericSearch.length >= 3) {
      orFilters.push(
        Prisma.sql`regexp_replace(coalesce(f."cnpj", ''), '\\D', '', 'g') ILIKE ${`%${numericSearch}%`}`,
      )
    }
    conditions.push(Prisma.sql`(${Prisma.join(orFilters, " OR ")})`)
  }

  const estado = sanitizeText(params.get("estado"))
  if (estado && estado !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(f."estado", '')`)} = ${normalizeForComparison(estado)}`,
    )
  }

  const cidade = sanitizeText(params.get("cidade"))
  if (cidade && cidade !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(f."cidade", '')`)} = ${normalizeForComparison(cidade)}`,
    )
  }

  const bairro = sanitizeText(params.get("bairro"))
  if (bairro.length > 0) {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(f."bairro", '')`)} = ${normalizeForComparison(bairro)}`,
    )
  }

  return conditions
}

const buildWhereClause = (conditions: Prisma.Sql[]) => {
  if (conditions.length === 0) {
    return Prisma.sql``
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
}

const parseTab = (value: string | null): TabKey => {
  const normalized = (value ?? "").toLowerCase()
  if (normalized === "renovacoes" || normalized === "ativos") return "ativos"
  if (normalized === "explorados") return "explorados"
  if (normalized === "cadastro-geral" || normalized === "pesquisa") return "pesquisa"
  // "agenda_all" busca TODOS os clientes com dataContatoAgendado (independente da categoria)
  if (normalized === "agenda_all") return "agenda_all"
  return "agendados"
}

const getTabSpecificConditions = (tab: TabKey, params: URLSearchParams) => {
  const conditions: Prisma.Sql[] = []
  const now = new Date()
  const defaultMonth = now.getMonth() + 1
  const defaultYear = now.getFullYear()

  const monthParam = toMonthNumber(params.get("month")) ?? defaultMonth
  const yearParam = toYearNumber(params.get("year")) ?? defaultYear

  // A API não faz julgamento de quem deve aparecer no dashboard.
  // Isso é responsabilidade do script cron que seta visivelDashVendedor = true.
  // Aqui apenas filtramos por categoria e condições específicas da agenda.

  if (tab === "agendados") {
    // Livres com data (categoria AGENDADO)
    conditions.push(Prisma.sql`c."categoria" = ${categoriaEnumSqlMap.AGENDADO}`)
  } else if (tab === "agenda_all") {
    // Agenda: clientes com dataContatoAgendado
    // Se month não foi passado, retorna TODOS (para buscar atrasos de qualquer data)
    // Se month foi passado, filtra pelo mês
    conditions.push(Prisma.sql`c."dataContatoAgendado" IS NOT NULL`)

    const hasMonthFilter = params.get("month") !== null
    if (hasMonthFilter) {
      const startUtc = new Date(Date.UTC(yearParam, monthParam - 1, 1, 0, 0, 0, 0))
      const nextMonthUtc = new Date(Date.UTC(yearParam, monthParam, 1, 0, 0, 0, 0))
      conditions.push(Prisma.sql`c."dataContatoAgendado" >= ${startUtc}`)
      conditions.push(Prisma.sql`c."dataContatoAgendado" < ${nextMonthUtc}`)
    }
  } else if (tab === "ativos") {
    // Renovações (categoria ATIVO)
    conditions.push(Prisma.sql`c."categoria" = ${categoriaEnumSqlMap.ATIVO}`)
  } else if (tab === "explorados") {
    // Livres sem data (categoria EXPLORADO)
    conditions.push(clientExploradoCondition)
  }

  if (tab === "pesquisa") {
    return { conditions: [], month: monthParam, year: yearParam }
  }

  return { conditions, month: monthParam, year: yearParam }
}

const orderByForTab = (tab: TabKey) => {
  switch (tab) {
    case "agendados":
    case "agenda_all":
      return Prisma.sql`ORDER BY c."dataContatoAgendado" ASC NULLS LAST, c."razaoSocial" ASC`
    case "ativos":
      return Prisma.sql`ORDER BY c."ultimaManutencao" ASC NULLS LAST, c."razaoSocial" ASC`
    case "explorados":
      return Prisma.sql`ORDER BY c."razaoSocial" ASC`
    default:
      return Prisma.sql`ORDER BY c."createdAt" DESC`
  }
}

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

type RawVendorClient = {
  id: number
  cnpj: string
  razaoSocial: string
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: CategoriaDbValue
  dataContatoAgendado: Date | null
  ultimaManutencao: Date | null
  observacao: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  telefoneCondominio: string | null
  celularCondominio: string | null
  telefonePorteiro: string | null
  updatedAt: Date
  kanbanCode: number | null
  kanbanPosition: number | null
  hasRecentOrcamento: boolean
  lastOrcamentoAt: Date | null
  totalPedidos: number
  ultimoPedidoValor: number | null
  ultimoPedidoValidoData: Date | null
  recentlyResearched: boolean
}

type RawFichaRow = {
  id: number
  cnpj: string
  razaoSocial: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  dataContatoAgendado: Date | null
  ultimaManutencao: Date | null
  observacao: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  updatedAt: Date
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const params = url.searchParams
    const tab = parseTab(params.get("tab"))

    // Obtém o vendedorId do contexto (usuário logado ou impersonation para admin)
    const { vendedorId, isMaster, isImpersonating } = await getVendedorContext(params)

    if (!vendedorId && !isMaster) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    const baseConditions = buildSearchConditions(params, vendedorId ?? "", isMaster, isImpersonating)
    const { conditions: tabConditions, month, year } = getTabSpecificConditions(tab, params)
    const allConditions = [...baseConditions, ...tabConditions]
    const whereClause = buildWhereClause(allConditions)
    const orderClause = orderByForTab(tab)

    const fichaConditions = buildFichaSearchConditions(params)
    const fichaWhereClause = buildWhereClause(fichaConditions)

    if (tab === "pesquisa") {
      const [fichas, agendadosCount, ativosCount, exploradosCount] = await Promise.all([
        prisma.$queryRaw<RawFichaRow[]>(Prisma.sql`
          SELECT
            f.id,
            f.cnpj,
            f."razaoSocial",
            f.bairro,
            f.cidade,
            f.estado,
            f."dataContatoAgendado",
            f."ultimaManutencao",
            f.observacao,
            f."nomeSindico",
            f."telefoneSindico",
            f."updatedAt"
          FROM "Ficha" f
          ${fichaWhereClause}
          ORDER BY f."updatedAt" DESC, f.id DESC
        `),
        prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS total
          FROM "Client" c
          ${buildWhereClause([...baseConditions, ...getTabSpecificConditions("agendados", params).conditions])}
        `),
        prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS total
          FROM "Client" c
          ${buildWhereClause([...baseConditions, ...getTabSpecificConditions("ativos", params).conditions])}
        `),
        prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS total
          FROM "Client" c
          ${buildWhereClause([...baseConditions, ...getTabSpecificConditions("explorados", params).conditions])}
        `),
      ])

      const data = fichas.map((ficha) => ({
        id: ficha.id,
        cnpj: ficha.cnpj,
        razaoSocial: ficha.razaoSocial ?? "Ficha sem razão social",
        bairro: ficha.bairro,
        cidade: ficha.cidade,
        estado: ficha.estado,
        categoria: "pesquisa" as const,
        dataContatoAgendado: ficha.dataContatoAgendado ? ficha.dataContatoAgendado.toISOString() : null,
        ultimaManutencao: ficha.ultimaManutencao ? ficha.ultimaManutencao.toISOString() : null,
        proximaRenovacao: null,
        observacao: ficha.observacao,
        nomeSindico: ficha.nomeSindico,
        telefoneSindico: ficha.telefoneSindico,
        ultimaAtualizacao: ficha.updatedAt.toISOString(),
      }))

      return NextResponse.json({
        data,
        total: fichas.length,
        summary: {
          agendados: agendadosCount[0]?.total ?? 0,
          ativos: ativosCount[0]?.total ?? 0,
          explorados: exploradosCount[0]?.total ?? 0,
          pesquisa: fichas.length,
        },
        filtersMeta: {
          month,
          year,
        },
      })
    }

    // Data limite para orçamentos recentes: últimos 2 meses
    const ORCAMENTO_MONTHS_LOOKBACK = 2
    const orcamentoDateLimit = new Date()
    orcamentoDateLimit.setMonth(orcamentoDateLimit.getMonth() - ORCAMENTO_MONTHS_LOOKBACK)

    const [clients, agendadosCount, ativosCount, exploradosCount, pesquisaCount] = await Promise.all([
      prisma.$queryRaw<RawVendorClient[]>(Prisma.sql`
        SELECT
          c.id,
          c.cnpj,
          c."razaoSocial",
          c.bairro,
          c.cidade,
          c.estado,
          c.categoria,
          c."dataContatoAgendado",
          c."ultimaManutencao",
          c.observacao,
          c."nomeSindico",
          c."telefoneSindico",
          c."telefoneCondominio",
          c."celularCondominio",
          c."telefonePorteiro",
          c."updatedAt",
          k."code" AS "kanbanCode",
          k."position" AS "kanbanPosition",
          (
            SELECT COUNT(*) > 0 FROM "Orcamento" o 
            WHERE o."clienteId" = c.id 
            AND o."createdAt" >= ${orcamentoDateLimit}
          )::boolean AS "hasRecentOrcamento",
          (
            SELECT MAX(o3."createdAt") FROM "Orcamento" o3
            WHERE o3."clienteId" = c.id
          ) AS "lastOrcamentoAt",
          (
            SELECT COUNT(*)::int FROM "Pedido" p
            JOIN "Orcamento" o2 ON o2.id = p."orcamentoId"
            WHERE o2."clienteId" = c.id
            AND p.status != 'CANCELADO'
            AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
          ) AS "totalPedidos"
          ,
          (
            SELECT COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0)
            FROM "Pedido" p2
            LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p2.id
            WHERE p2."clienteId" = c.id
            AND p2.status != 'CANCELADO'
            AND (p2."tipoEspecial" IS NULL OR p2."tipoEspecial" != 'OS')
            GROUP BY p2.id
            ORDER BY p2."createdAt" DESC
            LIMIT 1
          )::float AS "ultimoPedidoValor",
          (
            SELECT MAX(p3."createdAt")
            FROM "Pedido" p3
            JOIN "Orcamento" o4 ON o4.id = p3."orcamentoId"
            WHERE o4."clienteId" = c.id
            AND p3.status != 'CANCELADO'
            AND (p3."tipoEspecial" IS NULL OR p3."tipoEspecial" != 'OS')
          ) AS "ultimoPedidoValidoData",
          (
            SELECT EXISTS (
              SELECT 1 FROM (
                SELECT fl.tipo, fl."createdAt"
                FROM "FichaLog" fl
                JOIN "Ficha" f ON f.id = fl."fichaId"
                WHERE regexp_replace(f.cnpj, '\D', '', 'g') = regexp_replace(c.cnpj, '\D', '', 'g')
                ORDER BY fl."createdAt" DESC
                LIMIT 1
              ) last_log
              WHERE last_log.tipo = 'ENVIADO'
              AND last_log."createdAt" >= NOW() - INTERVAL '15 days'
            )
          ) AS "recentlyResearched"
        FROM "Client" c
        LEFT JOIN "ClientKanbanEstado" k ON k."clientId" = c.id
        ${whereClause}
        ${orderClause}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Client" c
        ${buildWhereClause([...baseConditions, ...getTabSpecificConditions("agendados", params).conditions])}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Client" c
        ${buildWhereClause([...baseConditions, ...getTabSpecificConditions("ativos", params).conditions])}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Client" c
        ${buildWhereClause([...baseConditions, ...getTabSpecificConditions("explorados", params).conditions])}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Ficha" f
        ${fichaWhereClause}
      `),
    ])

    const data = clients.map((client) => {
      const proximaRenovacao = client.ultimaManutencao ? addMonths(client.ultimaManutencao, 12) : null
      return {
        id: client.id,
        cnpj: client.cnpj,
        razaoSocial: client.razaoSocial,
        bairro: client.bairro,
        cidade: client.cidade,
        estado: client.estado,
        categoria: mapCategoria(client.categoria),
        kanbanCode: client.kanbanCode,
        kanbanPosition: client.kanbanPosition,
        dataContatoAgendado: client.dataContatoAgendado ? client.dataContatoAgendado.toISOString() : null,
        ultimaManutencao: client.ultimaManutencao ? client.ultimaManutencao.toISOString() : null,
        proximaRenovacao: proximaRenovacao ? proximaRenovacao.toISOString() : null,
        observacao: client.observacao,
        nomeSindico: client.nomeSindico,
        telefoneSindico: client.telefoneSindico,
        telefoneCondominio: client.telefoneCondominio,
        celularCondominio: client.celularCondominio,
        telefonePorteiro: client.telefonePorteiro,
        ultimaAtualizacao: client.updatedAt.toISOString(),
        hasRecentOrcamento: client.hasRecentOrcamento,
        lastOrcamentoAt: client.lastOrcamentoAt ? client.lastOrcamentoAt.toISOString() : null,
        totalPedidos: client.totalPedidos,
        ultimoPedidoValor: client.ultimoPedidoValor ?? 0,
        ultimoPedidoValidoData: client.ultimoPedidoValidoData ? client.ultimoPedidoValidoData.toISOString() : null,
        recentlyResearched: client.recentlyResearched,
      }
    })

    return NextResponse.json({
      data,
      total: clients.length,
      summary: {
        agendados: agendadosCount[0]?.total ?? 0,
        ativos: ativosCount[0]?.total ?? 0,
        explorados: exploradosCount[0]?.total ?? 0,
        pesquisa: pesquisaCount[0]?.total ?? 0,
      },
      filtersMeta: {
        month,
        year,
      },
    })
  } catch (error) {
    console.error("Erro ao buscar leads do vendedor:", error)
    return NextResponse.json({ error: "Erro ao buscar clientes do vendedor" }, { status: 500 })
  }
}

