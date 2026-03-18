import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { extractDigits, formatCnpjForDatabase } from "@/lib/cnpj"

const PAGE_SIZE = 50
const ACCENTED_CHARS = "ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ"
const UNACCENTED_CHARS = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn"

const sanitizeText = (value: string | null) => value?.trim() ?? ""
const sanitizeDigits = (value: string | null | undefined) => value?.replace(/\D/g, "").trim() ?? ""

const normalizeForComparison = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const escapeLikePattern = (value: string) => value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")

export const normalizeColumn = (column: Prisma.Sql) =>
  Prisma.sql`translate(lower(${column}), ${ACCENTED_CHARS}, ${UNACCENTED_CHARS})`

const buildLikeCondition = (column: Prisma.Sql, pattern: string) =>
  Prisma.sql`${normalizeColumn(column)} LIKE ${pattern} ESCAPE '\\'`

export const buildWhereConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []

  // Por padrão, filtrar apenas fichas EM_PESQUISA (fichas finalizadas já viraram clientes)
  conditions.push(Prisma.sql`f."fichaStatus" = 'EM_PESQUISA'`)

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
  if (bairro && bairro !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(f."bairro", '')`)} = ${normalizeForComparison(bairro)}`,
    )
  }

  const pesquisadorId = sanitizeText(params.get("pesquisadorId"))
  if (pesquisadorId && pesquisadorId !== "all") {
    conditions.push(Prisma.sql`f."pesquisadorId" = ${pesquisadorId}`)
  }

  const semPesquisador = params.get("semPesquisador")
  if (semPesquisador === "true") {
    conditions.push(Prisma.sql`f."pesquisadorId" IS NULL`)
  }

  return conditions
}

export const buildWhereClause = (conditions: Prisma.Sql[]) => {
  if (conditions.length === 0) {
    return Prisma.sql``
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
}

type RawFicha = {
  id: number
  cnpj: string
  razaoSocial: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  observacao: string | null
  fichaStatus: string
  updatedAt: Date
  pesquisadorName: string | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

    const whereConditions = buildWhereConditions(searchParams)
    const whereClause = buildWhereClause(whereConditions)

    const [totalResult, fichas] = await Promise.all([
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Ficha" f
        ${whereClause}
      `),
      prisma.$queryRaw<RawFicha[]>(Prisma.sql`
        SELECT
          f.id,
          f.cnpj,
          f."razaoSocial",
          f.logradouro,
          f.numero,
          f.bairro,
          f.cidade,
          f.estado,
          f."nomeSindico",
          f."telefoneSindico",
          f.observacao,
          f."fichaStatus",
          f."updatedAt",
          u.name as "pesquisadorName"
        FROM "Ficha" f
        LEFT JOIN "User" u ON u.id = f."pesquisadorId"
        ${whereClause}
        ORDER BY f."updatedAt" DESC, f.id DESC
        LIMIT ${PAGE_SIZE}
        OFFSET ${(page - 1) * PAGE_SIZE}
      `),
    ])

    const total = totalResult[0]?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)

    return NextResponse.json({
      data: fichas.map((ficha) => ({
        id: ficha.id,
        cnpj: ficha.cnpj,
        razaoSocial: ficha.razaoSocial,
        logradouro: ficha.logradouro,
        numero: ficha.numero,
        bairro: ficha.bairro,
        cidade: ficha.cidade,
        estado: ficha.estado,
        nomeSindico: ficha.nomeSindico,
        telefoneSindico: ficha.telefoneSindico,
        observacao: ficha.observacao,
        fichaStatus: ficha.fichaStatus,
        updatedAt: ficha.updatedAt.toISOString(),
        pesquisadorName: ficha.pesquisadorName,
      })),
      pagination: {
        page: currentPage,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
      },
    })
  } catch (error) {
    console.error("[fichas][GET]", error)
    return NextResponse.json({ error: "Erro ao listar fichas" }, { status: 500 })
  }
}

import { parseDateOnlySafe, parseDateTimeBrazil } from "@/lib/date-utils"
import { parseEspecificacaoCondominio } from "@/lib/constants/especificacao-condominio"

const sanitizeOptionalText = (value: string | null | undefined) => {
  const sanitized = sanitizeText(value ?? null)
  return sanitized.length > 0 ? sanitized : null
}

export async function POST(request: Request) {
  try {
    // Obtém o ID do usuário logado
    const currentUserId = await getLoggedUserId()

    if (!currentUserId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    const body = await request.json()

    // Valida e formata CNPJ
    let formattedCnpj: string
    try {
      formattedCnpj = formatCnpjForDatabase(body?.cnpj ?? null)
    } catch {
      return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 })
    }

    // Verifica se CNPJ já existe em Cliente ou Ficha
    const cnpjDigits = extractDigits(body?.cnpj ?? "")
    const [clienteExistente, fichaExistente] = await Promise.all([
      prisma.client.findFirst({
        where: {
          OR: [
            { cnpj: cnpjDigits },
            { cnpj: formattedCnpj },
          ],
        },
        select: { id: true, razaoSocial: true },
      }),
      prisma.ficha.findFirst({
        where: {
          OR: [
            { cnpj: cnpjDigits },
            { cnpj: formattedCnpj },
          ],
        },
        select: { id: true, razaoSocial: true },
      }),
    ])

    if (clienteExistente) {
      return NextResponse.json(
        { error: `CNPJ já cadastrado como Cliente: ${clienteExistente.razaoSocial || "sem nome"}` },
        { status: 409 },
      )
    }

    if (fichaExistente) {
      return NextResponse.json(
        { error: `CNPJ já cadastrado como Ficha: ${fichaExistente.razaoSocial || "sem nome"}` },
        { status: 409 },
      )
    }

    // Processa administradoraId como Int
    const administradoraIdRaw = body?.administradoraId
    const administradoraId = administradoraIdRaw ? Number.parseInt(String(administradoraIdRaw), 10) || null : null

    // Cria a ficha
    const ficha = await prisma.ficha.create({
      data: {
        cnpj: formattedCnpj,
        razaoSocial: sanitizeOptionalText(body?.razaoSocial),
        ultimaManutencao: parseDateOnlySafe(body?.ultimaManutencao),
        cep: sanitizeDigits(body?.cep),
        logradouro: sanitizeOptionalText(body?.logradouro),
        numero: sanitizeOptionalText(body?.numero),
        complemento: sanitizeOptionalText(body?.complemento),
        bairro: sanitizeOptionalText(body?.bairro),
        cidade: sanitizeOptionalText(body?.cidade),
        estado: sanitizeOptionalText(body?.estado),
        telefoneCondominio: sanitizeDigits(body?.telefoneCondominio),
        celularCondominio: sanitizeDigits(body?.celularCondominio),
        nomeSindico: sanitizeOptionalText(body?.nomeSindico),
        telefoneSindico: sanitizeDigits(body?.telefoneSindico),
        dataInicioMandato: parseDateOnlySafe(body?.dataInicioMandato),
        dataFimMandato: parseDateOnlySafe(body?.dataFimMandato),
        dataAniversarioSindico: parseDateOnlySafe(body?.dataAniversarioSindico),
        emailSindico: sanitizeOptionalText(body?.emailSindico),
        nomePorteiro: sanitizeOptionalText(body?.nomePorteiro),
        telefonePorteiro: sanitizeDigits(body?.telefonePorteiro),
        quantidadeSPDA: body?.quantidadeSPDA ? Number.parseInt(String(body.quantidadeSPDA), 10) || null : null,
        especificacaoCondominio: parseEspecificacaoCondominio(body?.especificacaoCondominio),
        observacao: sanitizeOptionalText(body?.observacao),
        dataContatoAgendado: parseDateTimeBrazil(body?.dataContatoAgendado),
        administradoraId,
        pesquisadorId: currentUserId,
      },
    })

    return NextResponse.json(
      {
        id: ficha.id,
        cnpj: ficha.cnpj,
        razaoSocial: ficha.razaoSocial,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma ficha com esse CNPJ" }, { status: 409 })
    }
    console.error("[fichas][POST]", error)
    return NextResponse.json({ error: "Erro ao criar ficha" }, { status: 500 })
  }
}

