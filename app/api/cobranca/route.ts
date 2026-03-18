import { NextResponse } from "next/server"
import { parseDateOnlySafe } from "@/lib/date-utils"
import { GetDebitoCobrancaUseCase, StatusFiltro } from "@/domain/financeiro/get-debito-cobranca.usecase"

const CLIENT_PAGE_SIZE_DEFAULT = 300
const CLIENT_PAGE_SIZE_MAX = 300

const parseDate = (value?: string | null) => {
  if (!value) return undefined
  return parseDateOnlySafe(value) ?? undefined
}

const parsePage = (value?: string | null) => {
  const page = Number(value || 1)
  if (!page || Number.isNaN(page) || page < 1) return 1
  return page
}

const parseClientPageSize = (value?: string | null) => {
  const size = Number(value || CLIENT_PAGE_SIZE_DEFAULT)
  if (!size || Number.isNaN(size) || size < 1) return CLIENT_PAGE_SIZE_DEFAULT
  return Math.min(size, CLIENT_PAGE_SIZE_MAX)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const statusParam = (url.searchParams.get("status") || "vencido") as StatusFiltro
  const vendedorId = url.searchParams.get("vendedorId") || undefined
  const empresaId = url.searchParams.get("empresaId")
  const startDate = parseDate(url.searchParams.get("startDate") || url.searchParams.get("start"))
  const endDate = parseDate(url.searchParams.get("endDate") || url.searchParams.get("end"))
  const occurrenceStart = parseDate(url.searchParams.get("occurrenceStart"))
  const occurrenceEnd = parseDate(url.searchParams.get("occurrenceEnd"))
  const search = url.searchParams.get("search") || undefined
  const clientPage = parsePage(url.searchParams.get("clientPage"))
  const clientPageSize = parseClientPageSize(url.searchParams.get("clientPageSize"))
  const clientLimitRaw = url.searchParams.get("clientLimit")
  const clientLimit = clientLimitRaw ? Number(clientLimitRaw) : undefined
  const order = (url.searchParams.get("order") || "desc").toLowerCase() === "asc" ? "asc" : "desc"

  try {
    const useCase = new GetDebitoCobrancaUseCase()
    const result = await useCase.execute({
      status: statusParam,
      vendedorId,
      empresaId: empresaId ? Number(empresaId) : undefined,
      startDate,
      endDate,
      occurrenceStart,
      occurrenceEnd,
      search,
      clientPage,
      clientPageSize,
      clientLimit,
      order: order as "asc" | "desc",
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao carregar dados de cobrança." }, { status: 500 })
  }
}

