/**
 * Utilitários para tratamento de datas com timezone -3 (America/Sao_Paulo)
 * 
 * O padrão da aplicação é parsear datas em -3.
 * 
 * Para campos de "data apenas" (sem horário), usamos um "horário safe" (12:00)
 * que garante que mesmo com erros de parsing, a data não muda de dia.
 * 
 * Campos que usam horário safe:
 * - ultimaManutencao
 * - dataInicioMandato
 * - dataFimMandato
 * - dataAniversarioSindico
 * 
 * Campos que usam horário real (precisão):
 * - dataContatoAgendado
 */

/**
 * Parseia uma data "apenas dia" (YYYY-MM-DD) usando horário safe (12:00) em -3
 * Evita o problema de voltar um dia por causa do timezone
 * 
 * @param value - string no formato YYYY-MM-DD ou ISO string
 * @returns Date ou null
 */
export function parseDateOnlySafe(value: string | null | undefined): Date | null {
  if (!value) return null

  // Se já é uma string completa com T, extrair só a parte da data
  const dateOnly = value.includes("T") ? value.split("T")[0] : value.trim()

  if (!dateOnly || dateOnly.length < 10) return null

  // Formato esperado: YYYY-MM-DD
  // Adiciona 12:00:00 como horário safe em timezone -3 (America/Sao_Paulo)
  const date = new Date(`${dateOnly}T12:00:00-03:00`)

  if (Number.isNaN(date.getTime())) return null

  return date
}

/**
 * Parseia uma data com horário (datetime) em -3
 * 
 * @param value - string com data e hora ou ISO string
 * @returns Date ou null
 */
export function parseDateTimeBrazil(value: string | null | undefined): Date | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // Se é só uma data (YYYY-MM-DD), assume 00:00:00 em -3
  if (!trimmed.includes("T") && trimmed.length === 10) {
    const date = new Date(`${trimmed}T00:00:00-03:00`)
    if (Number.isNaN(date.getTime())) return null
    return date
  }

  // Se é formato datetime-local (YYYY-MM-DDTHH:mm), adiciona -03:00
  if (trimmed.includes("T") && !trimmed.includes("Z") && !trimmed.includes("+") && !trimmed.includes("-", 10)) {
    const date = new Date(`${trimmed}:00-03:00`)
    if (Number.isNaN(date.getTime())) return null
    return date
  }

  // Se já tem timezone (Z ou offset), converte diretamente
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * Formata uma data ISO para valor de input date (YYYY-MM-DD)
 * Considera timezone -3 para extrair a data correta
 * 
 * @param value - ISO string ou Date
 * @returns string no formato YYYY-MM-DD ou vazio
 */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return ""

  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""

  // Formata usando o locale Brasil para extrair a data correta em -3
  const formatted = date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  return formatted // Formato YYYY-MM-DD
}

/**
 * Formata uma data ISO para valor de input datetime-local (YYYY-MM-DDTHH:mm)
 * Considera timezone -3 para extrair a data/hora correta
 * 
 * @param value - ISO string ou Date
 * @returns string no formato YYYY-MM-DDTHH:mm ou vazio
 */
export function toDateTimeInputValue(value: string | Date | null | undefined): string {
  if (!value) return ""

  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""

  // Formata usando opções para extrair data e hora em timezone -3
  const dateStr = date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  const timeStr = date.toLocaleTimeString("sv-SE", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit"
  })

  return `${dateStr}T${timeStr}` // Formato YYYY-MM-DDTHH:mm
}

/**
 * Creates a Date from year/month/day using safe noon time in Brazil timezone (-3)
 * Useful for display and date-only fields where you want to avoid day-shift issues
 * 
 * @param year - Full year (e.g., 2024)
 * @param month - Month (1-12)
 * @param day - Day of month (1-31)
 * @returns Date at noon Brazil time
 */
export function createBrazilDate(year: number, month: number, day: number): Date {
  const monthStr = String(month).padStart(2, "0")
  const dayStr = String(day).padStart(2, "0")
  return new Date(`${year}-${monthStr}-${dayStr}T12:00:00-03:00`)
}

/**
 * Creates a Date at the START of a day (00:00:00) in Brazil timezone (-3)
 * Use this for database range filters (startDate)
 * 
 * @param year - Full year (e.g., 2024)
 * @param month - Month (1-12)
 * @param day - Day of month (1-31)
 * @returns Date at midnight Brazil time (start of day)
 */
export function createBrazilDateStart(year: number, month: number, day: number): Date {
  const monthStr = String(month).padStart(2, "0")
  const dayStr = String(day).padStart(2, "0")
  return new Date(`${year}-${monthStr}-${dayStr}T00:00:00-03:00`)
}

/**
 * Gets current date/time components in Brazil timezone
 * 
 * @returns Object with year, month (1-12), day, hour, minute
 */
export function getNowBrazil(): { year: number; month: number; day: number; hour: number; minute: number } {
  const now = new Date()
  const brDateStr = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  const brTimeStr = now.toLocaleTimeString("sv-SE", { timeZone: "America/Sao_Paulo", hour12: false })
  const [year, month, day] = brDateStr.split("-").map(Number)
  const [hour, minute] = brTimeStr.split(":").map(Number)
  return { year, month, day, hour, minute }
}

/**
 * Parseia uma data para o FINAL do dia (23:59:59.999) em timezone -3
 * Use para filtros `lte` onde você quer incluir todo o dia
 * 
 * @param value - string no formato YYYY-MM-DD
 * @returns Date no final do dia ou null
 */
export function parseDateEndOfDay(value: string | null | undefined): Date | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed || trimmed.length < 10) return null

  // Extrai só a parte da data se vier com T
  const dateOnly = trimmed.includes("T") ? trimmed.split("T")[0] : trimmed

  // Cria a data no final do dia em -3
  const date = new Date(`${dateOnly}T23:59:59.999-03:00`)

  if (Number.isNaN(date.getTime())) return null

  return date
}

export type PeriodType = "dia" | "semana" | "mes" | "trimestre" | "semestre" | "ano" | "total"

/**
 * Retorna os componentes de data (ano, mês, dia) em timezone Brasil (-3)
 * @param date - Objeto Date
 */
export function getComponentsBrazil(date: Date): { year: number; month: number; day: number } {
  const brDateStr = date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  const [year, month, day] = brDateStr.split("-").map(Number)
  return { year, month, day }
}

/**
 * Creates a date range for database filtering based on period type
 * Returns half-open interval [startDate, endDate) - inclusive start, exclusive end
 * Uses midnight (00:00:00) Brazil time for precise day boundaries
 * 
 * @param period - Period type: "dia", "semana", "mes", "trimestre", "semestre", "ano", "total"
 * @param month - Reference month (1-12)
 * @param year - Reference year
 * @param day - Reference day (1-31), used for "dia" and "semana"
 * @returns Object with startDate and endDate for filtering
 */
export function createPeriodRange(
  period: PeriodType,
  month: number,
  year: number,
  day: number = 1
): { startDate: Date; endDate: Date } {
  if (period === "total") {
    return {
      startDate: createBrazilDateStart(2000, 1, 1),
      endDate: createBrazilDateStart(2100, 1, 1),
    }
  }

  if (period === "dia") {
    const startDate = createBrazilDateStart(year, month, day)
    // Adiciona 24 horas e recalcula componentes para o endDate
    const nextDayRef = new Date(startDate.getTime() + 26 * 60 * 60 * 1000) // 26h para garantir que passou da meia-noite
    const comps = getComponentsBrazil(nextDayRef)
    return {
      startDate,
      endDate: createBrazilDateStart(comps.year, comps.month, comps.day),
    }
  }

  if (period === "semana") {
    const refDate = createBrazilDate(year, month, day)
    const dayOfWeek = refDate.getDay() // 0 = Domingo, 1 = Segunda...

    // Início da semana (domingo anterior ou hoje se for domingo)
    const startRef = new Date(refDate.getTime() - dayOfWeek * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)
    const sComps = getComponentsBrazil(startRef)
    const startDate = createBrazilDateStart(sComps.year, sComps.month, sComps.day)

    // Fim da semana (próximo domingo)
    const endRef = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)
    const eComps = getComponentsBrazil(endRef)
    const endDate = createBrazilDateStart(eComps.year, eComps.month, eComps.day)

    return { startDate, endDate }
  }

  if (period === "ano") {
    return {
      startDate: createBrazilDateStart(year, 1, 1),
      endDate: createBrazilDateStart(year + 1, 1, 1),
    }
  }

  if (period === "semestre") {
    const semesterStart = month <= 6 ? 1 : 7
    const nextSemester = semesterStart === 1 ? 7 : 1
    const endYear = semesterStart === 7 ? year + 1 : year
    return {
      startDate: createBrazilDateStart(year, semesterStart, 1),
      endDate: createBrazilDateStart(endYear, nextSemester, 1),
    }
  }

  if (period === "trimestre") {
    const quarterStart = Math.floor((month - 1) / 3) * 3 + 1
    let nextQuarter = quarterStart + 3
    let endYear = year
    if (nextQuarter > 12) {
      nextQuarter = 1
      endYear = year + 1
    }
    return {
      startDate: createBrazilDateStart(year, quarterStart, 1),
      endDate: createBrazilDateStart(endYear, nextQuarter, 1),
    }
  }

  // mes (default)
  let nextMonth = month + 1
  let endYear = year
  if (nextMonth > 12) {
    nextMonth = 1
    endYear = year + 1
  }
  return {
    startDate: createBrazilDateStart(year, month, 1),
    endDate: createBrazilDateStart(endYear, nextMonth, 1),
  }
}

