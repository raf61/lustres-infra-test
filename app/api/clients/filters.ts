import { Prisma } from "@prisma/client"

const ACCENTED_CHARS = "ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ"
const UNACCENTED_CHARS = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn"

type CategoriaDbValue = "ATIVO" | "AGENDADO" | "EXPLORADO" | null
export type CategoriaFiltro = "ativo" | "agendado" | "explorado" | "perdida"

export const toMonthNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) return null
  return parsed
}

export const toYearNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) return null
  return parsed
}

export const normalizeCategoriaParam = (value: string | null): CategoriaFiltro | null => {
  if (!value) return null
  const normalized = value.toLowerCase()
  if (normalized === "ativo" || normalized === "agendado" || normalized === "explorado" || normalized === "perdida") {
    return normalized as CategoriaFiltro
  }
  return null
}

export const categoriaEnumSqlMap: Record<Exclude<CategoriaFiltro, "perdida">, Prisma.Sql> = {
  ativo: Prisma.sql`'ATIVO'::"ClientCategoria"`,
  agendado: Prisma.sql`'AGENDADO'::"ClientCategoria"`,
  explorado: Prisma.sql`'EXPLORADO'::"ClientCategoria"`,
}
export const categoriaEnumList = [categoriaEnumSqlMap.ativo, categoriaEnumSqlMap.agendado, categoriaEnumSqlMap.explorado]
export const clienteExploradoCondition = Prisma.sql`(c."categoria" IS NULL OR c."categoria" NOT IN (${categoriaEnumSqlMap.ativo}, ${categoriaEnumSqlMap.agendado}))`

const sanitizeText = (value: string | null) => value?.trim() ?? ""
const sanitizeDigits = (value: string | null | undefined) => {
  const digits = value ? value.replace(/\D/g, "").trim() : ""
  return digits.length > 0 ? digits : null
}

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

export const buildWhereConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []

  const cnpj = sanitizeDigits(params.get("cnpj"))
  if (cnpj && cnpj.length > 0) {
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
    const searchableColumns = [
      Prisma.sql`coalesce(c."razaoSocial", '')`,
      Prisma.sql`coalesce(c."logradouro", '')`,
      Prisma.sql`coalesce(c."cidade", '')`,
      Prisma.sql`coalesce(c."bairro", '')`,
      Prisma.sql`coalesce(c."estado", '')`,
      Prisma.sql`coalesce(c."nomeSindico", '')`,
    ]
    const stopwords = new Set(["da", "de", "do", "das", "dos", "e"])
    const tokens = normalizedSearch
      .split(/\s+/g)
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => t.length >= 2 && !stopwords.has(t))

    // Se houver termos, exige que TODOS existam (AND), mas cada termo pode bater em qualquer coluna pesquisável (OR).
    // Ex.: "jose neves" -> (col LIKE %jose%) AND (col LIKE %neves%)
    const textCondition =
      tokens.length >= 1
        ? Prisma.sql`${Prisma.join(
          tokens.map((token) => {
            const tokenPattern = `%${escapeLikePattern(token)}%`
            const tokenOr = searchableColumns.map((column) => buildLikeCondition(column, tokenPattern))
            return Prisma.sql`(${Prisma.join(tokenOr, " OR ")})`
          }),
          " AND "
        )}`
        : (() => {
          const pattern = `%${escapeLikePattern(normalizedSearch)}%`
          return Prisma.sql`${Prisma.join(
            searchableColumns.map((column) => buildLikeCondition(column, pattern)),
            " OR "
          )}`
        })()

    const orFilters: Prisma.Sql[] = [Prisma.sql`(${textCondition})`]

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
  if (bairro && bairro !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(c."bairro", '')`)} = ${normalizeForComparison(bairro)}`,
    )
  }

  // Busca específica por telefone (apenas dígitos)
  const telefone = sanitizeDigits(params.get("telefone"))
  if (telefone && telefone.length >= 3) {
    const phonePattern = `%${telefone}%`
    conditions.push(
      Prisma.sql`(
        regexp_replace(coalesce(c."telefoneCondominio", ''), '\\D', '', 'g') ILIKE ${phonePattern}
        OR regexp_replace(coalesce(c."celularCondominio", ''), '\\D', '', 'g') ILIKE ${phonePattern}
        OR regexp_replace(coalesce(c."telefoneSindico", ''), '\\D', '', 'g') ILIKE ${phonePattern}
        OR regexp_replace(coalesce(c."telefonePorteiro", ''), '\\D', '', 'g') ILIKE ${phonePattern}
      )`
    )
  }

  const vendedorId = sanitizeText(params.get("vendedorId"))
  if (vendedorId) {
    conditions.push(Prisma.sql`c."vendedorId" = ${vendedorId}`)
  }

  const semVendedor = params.get("semVendedor")
  if (semVendedor === "true") {
    conditions.push(Prisma.sql`c."vendedorId" IS NULL`)
  }

  // Filtro por contrato vigente
  const contratoVigente = params.get("contratoVigente")
  const now = new Date()
  if (contratoVigente === "true") {
    conditions.push(
      Prisma.sql`
        EXISTS (
          SELECT 1 FROM "ContratoManutencao" cm
          WHERE cm."clienteId" = c.id
          AND cm.status = 'OK'
          AND cm."dataFim" >= CURRENT_DATE
        )
      `
    )
  } else if (contratoVigente === "false") {
    conditions.push(
      Prisma.sql`
        NOT EXISTS (
          SELECT 1 FROM "ContratoManutencao" cm
          WHERE cm."clienteId" = c.id
          AND cm.status = 'OK'
          AND cm."dataFim" >= CURRENT_DATE
        )
      `
    )
  }

  // Filtro por histórico de pedidos (simples booleano)
  const temPedido = params.get("temPedido")
  if (temPedido === "true") {
    conditions.push(
      Prisma.sql`
        EXISTS (
          SELECT 1 FROM "Pedido" p
          WHERE p."clienteId" = c.id
          AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        )
      `,
    )
  } else if (temPedido === "false") {
    conditions.push(
      Prisma.sql`
        NOT EXISTS (
          SELECT 1 FROM "Pedido" p
          WHERE p."clienteId" = c.id
          AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        )
      `,
    )
  }

  return conditions
}

export const buildOrderConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []
  const mode = params.get("pedidoMode") // 'com' | 'sem'
  const unit = params.get("pedidoUnit") ?? 'm' // 'd' | 'm'
  const daysStr = params.get("pedidoDays")
  const monthsStr = params.get("pedidoMonths")
  const minItemsStr = params.get("pedidoMinItems")

  if (mode === "com" || mode === "sem") {
    const dateLimit = new Date()
    if (unit === 'd') {
      const days = daysStr ? parseInt(daysStr, 10) : 30
      dateLimit.setDate(dateLimit.getDate() - days)
    } else {
      const months = monthsStr ? parseInt(monthsStr, 10) : 4
      dateLimit.setMonth(dateLimit.getMonth() - months)
    }
    dateLimit.setHours(0, 0, 0, 0)

    const minItems = minItemsStr ? parseInt(minItemsStr, 10) : null

    const existsClause = minItems && minItems > 1
      ? Prisma.sql`EXISTS (
          SELECT 1 FROM "Pedido" p
          WHERE p."clienteId" = c.id
          AND p."createdAt" >= ${dateLimit}
          AND (SELECT COUNT(*) FROM "PedidoItem" pi WHERE pi."pedidoId" = p.id) >= ${minItems}
        )`
      : Prisma.sql`EXISTS (SELECT 1 FROM "Pedido" p WHERE p."clienteId" = c.id AND p."createdAt" >= ${dateLimit})`

    if (mode === "com") {
      conditions.push(existsClause)
    } else {
      conditions.push(Prisma.sql`NOT ${existsClause}`)
    }
  }
  return conditions
}

export const buildBudgetConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []
  const mode = params.get("orcamentoMode")
  const unit = params.get("orcamentoUnit") ?? 'm'
  const daysStr = params.get("orcamentoDays")
  const monthsStr = params.get("orcamentoMonths")
  const minItemsStr = params.get("orcamentoMinItems")

  if (mode === "com" || mode === "sem") {
    const dateLimit = new Date()
    if (unit === 'd') {
      const days = daysStr ? parseInt(daysStr, 10) : 30
      dateLimit.setDate(dateLimit.getDate() - days)
    } else {
      const months = monthsStr ? parseInt(monthsStr, 10) : 4
      dateLimit.setMonth(dateLimit.getMonth() - months)
    }
    dateLimit.setHours(0, 0, 0, 0)

    const minItems = minItemsStr ? parseInt(minItemsStr, 10) : null

    const existsClause = minItems && minItems > 1
      ? Prisma.sql`EXISTS (
          SELECT 1 FROM "Orcamento" o
          WHERE o."clienteId" = c.id
          AND o."createdAt" >= ${dateLimit}
          AND (SELECT COUNT(*) FROM "OrcamentoItem" oi WHERE oi."orcamentoId" = o.id) >= ${minItems}
        )`
      : Prisma.sql`EXISTS (SELECT 1 FROM "Orcamento" o WHERE o."clienteId" = c.id AND o."createdAt" >= ${dateLimit})`

    if (mode === "com") {
      conditions.push(existsClause)
    } else {
      conditions.push(Prisma.sql`NOT ${existsClause}`)
    }
  }
  return conditions
}

export const buildHistoryConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []
  const mode = params.get("historyMode")
  const valueStr = params.get("historyValue")
  const unit = params.get("historyUnit")

  if (mode === "com" || mode === "sem") {
    const value = valueStr ? parseInt(valueStr, 10) : 1
    const intervalStr = unit === 'h' ? `${value} hours` : unit === 'd' ? `${value} days` : `${value} months`

    // Condição baseada puramente no histórico (ignora visivelDashVendedor que pode estar inconsistente)
    // Consideramos "COM" se o último registro for INDASH ou for um OUTDASH dentro do período.
    const checkCondition = Prisma.sql`
      EXISTS (
        SELECT 1 FROM (
          SELECT h.type, h."createdAt"
          FROM "HistoricoClient" h
          WHERE h."clientId" = c.id AND h.type IN ('INDASH', 'OUTDASH')
          ORDER BY h."createdAt" DESC, h.id DESC
          LIMIT 1
        ) AS last_h
        WHERE last_h.type = 'INDASH'
           OR (last_h.type = 'OUTDASH' AND last_h."createdAt" >= now() - (${intervalStr})::interval)
      )
    `

    if (mode === "com") {
      conditions.push(checkCondition)
    } else { // sem
      // Negação da condição acima: não tem histórico OU o último é OUTDASH antigo.
      conditions.push(Prisma.sql`NOT ${checkCondition}`)
    }
  }
  return conditions
}

export const buildContactConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []
  const mode = params.get("contactMode")
  const valueStr = params.get("contactValue")
  const unit = params.get("contactUnit")

  if (mode === "com" || mode === "sem") {
    const value = valueStr ? parseInt(valueStr, 10) : 1
    const dateLimit = new Date()

    if (unit === 'h') dateLimit.setHours(dateLimit.getHours() - value)
    else if (unit === 'd') dateLimit.setDate(dateLimit.getDate() - value)
    else if (unit === 'm') dateLimit.setMonth(dateLimit.getMonth() - value)
    else dateLimit.setMonth(dateLimit.getMonth() - value)

    const existsContactWithActivity = Prisma.sql`
      EXISTS (
        SELECT 1 FROM "client_chat_contacts" ccc
        JOIN "chat_conversations" conv ON conv."contactId" = ccc."contactId"
        WHERE ccc."clientId" = c.id
        AND conv."lastActivityAt" >= ${dateLimit}
      )
    `

    if (mode === "com") {
      conditions.push(existsContactWithActivity)
    } else { // sem
      conditions.push(Prisma.sql`NOT ${existsContactWithActivity}`)
    }
  }
  return conditions
}

export const buildScheduledDateConditions = (params: URLSearchParams): Prisma.Sql[] => {
  // Esta função agora retorna vazio para evitar conflito com buildCategoryConditions
  // que já gerencia as datas para Livres com Data (AGENDADO) de forma consistente com os stats.
  return []
}

export const buildCategoryConditions = (params: URLSearchParams) => {
  const conditions: Prisma.Sql[] = []
  const categoriaParam = normalizeCategoriaParam(params.get("categoria"))

  if (categoriaParam === "explorado") {
    conditions.push(clienteExploradoCondition)
  } else if (categoriaParam && categoriaParam !== "perdida") {
    const validKey = categoriaParam as keyof typeof categoriaEnumSqlMap
    conditions.push(Prisma.sql`c."categoria" = ${categoriaEnumSqlMap[validKey]}`)
  }

  // Ativo: próxima manutenção (ultima + 1 ano) dentro do mês/ano
  if (categoriaParam === "ativo") {
    const monthNumber = toMonthNumber(params.get("month"))
    if (monthNumber !== null) {
      const selectedYear = toYearNumber(params.get("year")) ?? new Date().getFullYear()
      const startOfMonth = new Date(selectedYear, monthNumber - 1, 1)
      const endOfMonth = new Date(selectedYear, monthNumber, 1)
      conditions.push(Prisma.sql`c."ultimaManutencao" IS NOT NULL`)
      conditions.push(
        Prisma.sql`(c."ultimaManutencao" + interval '1 year') >= ${startOfMonth} AND (c."ultimaManutencao" + interval '1 year') < ${endOfMonth}`,
      )
    }
  }

  // Agendado (Livres com data): ultimaManutencao (com concorrente) que vence no mês selecionado
  // Se o usuário seleciona Janeiro de 2026, mostramos clientes cuja ultimaManutencao foi em Janeiro de 2025
  // (porque a manutenção vence 12 meses depois)
  if (categoriaParam === "agendado") {
    const monthNumber = toMonthNumber(params.get("month"))
    if (monthNumber !== null) {
      const selectedYear = toYearNumber(params.get("year")) ?? new Date().getFullYear()
      // A ultimaManutencao deve ser de 12 meses antes do mês/ano selecionado
      const manutencaoYear = selectedYear - 1
      const startOfMonth = new Date(Date.UTC(manutencaoYear, monthNumber - 1, 1, 0, 0, 0, 0))
      const startOfNextMonth = new Date(Date.UTC(manutencaoYear, monthNumber, 1, 0, 0, 0, 0))
      conditions.push(Prisma.sql`c."ultimaManutencao" IS NOT NULL`)
      conditions.push(Prisma.sql`c."ultimaManutencao" >= ${startOfMonth}`)
      conditions.push(Prisma.sql`c."ultimaManutencao" < ${startOfNextMonth}`)
    } else {
      const selectedYear = toYearNumber(params.get("year")) ?? new Date().getFullYear()
      const manutencaoYear = selectedYear - 1
      const startOfYear = new Date(Date.UTC(manutencaoYear, 0, 1, 0, 0, 0, 0))
      const startOfNextYear = new Date(Date.UTC(manutencaoYear + 1, 0, 1, 0, 0, 0, 0))
      conditions.push(Prisma.sql`c."ultimaManutencao" IS NOT NULL`)
      conditions.push(Prisma.sql`c."ultimaManutencao" >= ${startOfYear}`)
      conditions.push(Prisma.sql`c."ultimaManutencao" < ${startOfNextYear}`)
    }
  }

  // Perdida: Não é ativo, mas deveria renovar no mês selecionado
  if (categoriaParam === "perdida") {
    // 1. Status diferente de ATIVO
    conditions.push(Prisma.sql`(c."categoria" IS NULL OR c."categoria" != ${categoriaEnumSqlMap.ativo})`)

    const monthNumber = toMonthNumber(params.get("month"))
    const yearNumber = toYearNumber(params.get("year")) ?? new Date().getFullYear()

    if (monthNumber !== null) {
      // Mês Específico selecionado
      // REGRA: Teve pedido no mesmo mês do ano anterior
      const baseYear = yearNumber - 1
      const baseStart = new Date(baseYear, monthNumber - 1, 1)
      const baseEnd = new Date(baseYear, monthNumber, 1)

      // REGRA: NÃO teve pedido num raio de +/- 2 meses do mês alvo no ano selecionado
      // Janela: 2 meses antes (início) até 2 meses depois (fim)
      const windowStart = new Date(yearNumber, monthNumber - 1 - 2, 1)
      const windowEnd = new Date(yearNumber, monthNumber - 1 + 3, 1)

      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Pedido" p 
        WHERE p."clienteId" = c.id 
        AND p."createdAt" >= ${baseStart} AND p."createdAt" < ${baseEnd}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      )`)

      conditions.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM "Pedido" p 
        WHERE p."clienteId" = c.id 
        AND p."createdAt" >= ${windowStart} AND p."createdAt" < ${windowEnd}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      )`)
    } else {
      // Ano Todo selecionado
      // REGRA: Teve pedido no ano anterior
      const baseStart = new Date(yearNumber - 1, 0, 1)
      const baseEnd = new Date(yearNumber, 0, 1)

      // REGRA: NÃO teve pedido no ano alvo
      const windowStart = new Date(yearNumber, 0, 1)
      const windowEnd = new Date(yearNumber + 1, 0, 1)

      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Pedido" p 
        WHERE p."clienteId" = c.id 
        AND p."createdAt" >= ${baseStart} AND p."createdAt" < ${baseEnd}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      )`)

      conditions.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM "Pedido" p 
        WHERE p."clienteId" = c.id 
        AND p."createdAt" >= ${windowStart} AND p."createdAt" < ${windowEnd}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      )`)
    }
  }

  return conditions
}

export const buildWhereClause = (conditions: Prisma.Sql[]) => {
  if (conditions.length === 0) {
    return Prisma.sql``
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
}

