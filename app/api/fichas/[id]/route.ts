import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateOnlySafe, parseDateTimeBrazil } from "@/lib/date-utils"
import { parseEspecificacaoCondominio } from "@/lib/constants/especificacao-condominio"

// === Transformadores de campos ===
const sanitizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "") 
const sanitizeOptionalText = (value: unknown) => {
  const sanitized = sanitizeText(value)
  return sanitized.length > 0 ? sanitized : null
}
const sanitizeDigits = (value: unknown) => {
  if (typeof value !== "string") return null
  const digits = value.replace(/\D/g, "").trim()
  return digits.length > 0 ? digits : null
}
const parseOptionalInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

// === Definição de campos atualizáveis e seus transformadores ===
type FieldTransformer = (value: unknown) => unknown

const FICHA_FIELD_TRANSFORMERS: Record<string, FieldTransformer> = {
  // Texto simples
  razaoSocial: sanitizeOptionalText,
  logradouro: sanitizeOptionalText,
  numero: sanitizeOptionalText,
  complemento: sanitizeOptionalText,
  bairro: sanitizeOptionalText,
  cidade: sanitizeOptionalText,
  estado: sanitizeOptionalText,
  nomeSindico: sanitizeOptionalText,
  emailSindico: sanitizeOptionalText,
  nomePorteiro: sanitizeOptionalText,
  observacao: sanitizeOptionalText,
  
  // Campos de dígitos (telefone, CEP)
  cep: sanitizeDigits,
  telefoneCondominio: sanitizeDigits,
  celularCondominio: sanitizeDigits,
  telefoneSindico: sanitizeDigits,
  telefonePorteiro: sanitizeDigits,
  
  // Datas simples
  ultimaManutencao: parseDateOnlySafe,
  dataInicioMandato: parseDateOnlySafe,
  dataFimMandato: parseDateOnlySafe,
  dataAniversarioSindico: parseDateOnlySafe,
  
  // DateTime
  dataContatoAgendado: parseDateTimeBrazil,
  
  // Inteiros
  quantidadeSPDA: parseOptionalInt,
  administradoraId: parseOptionalInt,
  
  // Enums
  especificacaoCondominio: parseEspecificacaoCondominio,
}

/** Extrai e transforma apenas os campos definidos no body */
function buildUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {}
  
  for (const [field, transformer] of Object.entries(FICHA_FIELD_TRANSFORMERS)) {
    if (body[field] !== undefined) {
      updateData[field] = transformer(body[field])
    }
  }
  
  return updateData
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const fichaId = Number.parseInt(id, 10)

    if (Number.isNaN(fichaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const ficha = (await prisma.ficha.findUnique({
      where: { id: fichaId },
      include: {
        administradora: {
          select: {
            id: true,
            nome: true,
          },
        },
        pesquisador: {
          select: {
            id: true,
            name: true,
          },
        },
        logs: {
          select: {
            id: true,
            tipo: true,
            createdAt: true,
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })) as any

    if (!ficha) {
      return NextResponse.json({ error: "Ficha não encontrada" }, { status: 404 })
    }

    const f = ficha as any

    return NextResponse.json({
      id: f.id,
      cnpj: f.cnpj,
      razaoSocial: f.razaoSocial,
      fichaStatus: f.fichaStatus,
      ultimaManutencao: f.ultimaManutencao?.toISOString() ?? null,
      cep: f.cep,
      logradouro: f.logradouro,
      numero: f.numero,
      complemento: f.complemento,
      bairro: f.bairro,
      estado: f.estado,
      cidade: f.cidade,
      telefoneCondominio: f.telefoneCondominio,
      celularCondominio: f.celularCondominio,
      nomeSindico: f.nomeSindico,
      telefoneSindico: f.telefoneSindico,
      dataInicioMandato: f.dataInicioMandato?.toISOString() ?? null,
      dataFimMandato: f.dataFimMandato?.toISOString() ?? null,
      dataAniversarioSindico: f.dataAniversarioSindico?.toISOString() ?? null,
      emailSindico: f.emailSindico,
      nomePorteiro: f.nomePorteiro,
      telefonePorteiro: f.telefonePorteiro,
      quantidadeSPDA: f.quantidadeSPDA,
      especificacaoCondominio: f.especificacaoCondominio,
      observacao: f.observacao,
      dataContatoAgendado: f.dataContatoAgendado?.toISOString() ?? null,
      administradora: f.administradora,
      pesquisador: f.pesquisador,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      logs:
        f.logs?.map((log: any) => ({
          id: log.id,
          tipo: log.tipo,
          createdAt: log.createdAt.toISOString(),
          user: { id: log.user?.id ?? null, name: log.user?.name ?? "Sem nome" },
        })) ?? [],
    })
  } catch (error) {
    console.error("[fichas][id][GET]", error)
    return NextResponse.json({ error: "Erro ao buscar ficha" }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const fichaId = Number.parseInt(id, 10)

    if (Number.isNaN(fichaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const existingFicha = await prisma.ficha.findUnique({
      where: { id: fichaId },
    })

    if (!existingFicha) {
      return NextResponse.json({ error: "Ficha não encontrada" }, { status: 404 })
    }

    const body = await request.json()

    // Preparar dados para atualização usando mapeamento declarativo
    const updateData = buildUpdateData(body)

    const updatedFicha = (await prisma.ficha.update({
      where: { id: fichaId },
      data: updateData,
      include: {
        administradora: {
          select: {
            id: true,
            nome: true,
          },
        },
        pesquisador: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })) as any

    const uf = updatedFicha as any

    return NextResponse.json({
      id: uf.id,
      cnpj: uf.cnpj,
      razaoSocial: uf.razaoSocial,
      fichaStatus: uf.fichaStatus,
      ultimaManutencao: uf.ultimaManutencao?.toISOString() ?? null,
      cep: uf.cep,
      logradouro: uf.logradouro,
      numero: uf.numero,
      complemento: uf.complemento,
      bairro: uf.bairro,
      estado: uf.estado,
      cidade: uf.cidade,
      telefoneCondominio: uf.telefoneCondominio,
      celularCondominio: uf.celularCondominio,
      nomeSindico: uf.nomeSindico,
      telefoneSindico: uf.telefoneSindico,
      dataInicioMandato: uf.dataInicioMandato?.toISOString() ?? null,
      dataFimMandato: uf.dataFimMandato?.toISOString() ?? null,
      dataAniversarioSindico: uf.dataAniversarioSindico?.toISOString() ?? null,
      emailSindico: uf.emailSindico,
      nomePorteiro: uf.nomePorteiro,
      telefonePorteiro: uf.telefonePorteiro,
      quantidadeSPDA: uf.quantidadeSPDA,
      especificacaoCondominio: uf.especificacaoCondominio,
      observacao: uf.observacao,
      dataContatoAgendado: uf.dataContatoAgendado?.toISOString() ?? null,
      administradora: uf.administradora,
      pesquisador: uf.pesquisador,
      createdAt: uf.createdAt.toISOString(),
      updatedAt: uf.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error("[fichas][id][PUT]", error)
    return NextResponse.json({ error: "Erro ao atualizar ficha" }, { status: 500 })
  }
}

