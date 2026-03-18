import { Prisma } from "@prisma/client"

import { formatCnpjForDatabase } from "@/lib/cnpj"
import { parseDateOnlySafe, parseDateTimeBrazil, toDateInputValue } from "@/lib/date-utils"
import { parseEspecificacaoCondominio } from "@/lib/constants/especificacao-condominio"

/**
 * Verifica se ultimaManutencao e ultimoPedido estão no mesmo dia (timezone Brasil).
 * Se estiverem, retorna o ultimoPedido (preservando horário).
 * Caso contrário, retorna ultimaManutencao como está.
 * 
 * Isso evita que edições manuais de data (que perdem o horário) 
 * quebrem o cálculo de categoria quando são do mesmo dia do pedido.
 */
export function normalizeUltimaManutencaoWithLastOrder(
  ultimaManutencao: Date | null,
  ultimoPedido: Date | null
): Date | null {
  if (!ultimaManutencao || !ultimoPedido) return ultimaManutencao

  // Extrai apenas a data (YYYY-MM-DD) no timezone Brasil
  const manutencaoDay = toDateInputValue(ultimaManutencao)
  const pedidoDay = toDateInputValue(ultimoPedido)

  // Se são do mesmo dia, usar o timestamp exato do pedido
  if (manutencaoDay === pedidoDay) {
    return ultimoPedido
  }

  return ultimaManutencao
}

// Helpers de normalização
const sanitizeOptionalText = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const sanitizeDigits = (value: unknown) => {
  if (typeof value !== "string") return null
  const digits = value.trim().replace(/\D/g, "")
  return digits.length > 0 ? digits : null
}

const parseOptionalInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

type BuildError = { message: string; status: number }

type BuildResult =
  | { ok: true; data: Prisma.ClientCreateInput }
  | { ok: false; error: BuildError }

/**
 * Constrói o payload para criação de Client a partir do body cru.
 * Mantém a mesma lógica existente (sanitização e defaults).
 */
export function buildClientCreateData(body: any): BuildResult {
  let formattedCnpj: string
  try {
    formattedCnpj = formatCnpjForDatabase(body?.cnpj ?? null)
  } catch {
    return { ok: false, error: { message: "CNPJ inválido", status: 400 } }
  }

  const razaoSocial = sanitizeOptionalText(body?.razaoSocial)
  if (!razaoSocial) {
    return { ok: false, error: { message: "Razão Social é obrigatória", status: 400 } }
  }

  const quantidadeSPDA = body?.qtdSPDA ?? body?.quantidadeSPDA
  const quantidadeAndares = body?.quantidadeAndares ?? body?.qtdAndares
  const administradoraIdRaw = body?.administradoraId
  const administradoraId = administradoraIdRaw ? Number.parseInt(String(administradoraIdRaw), 10) || null : null

  const data: Prisma.ClientCreateInput = {
    cnpj: formattedCnpj,
    razaoSocial,
    categoria: "EXPLORADO",
    // ultimaManutencao pode vir como:
    // - "YYYY-MM-DD" (concorrente) -> parse em -03 (00:00)
    // - ISO string com horário (ex: timestamp do último pedido) -> preserva o horário
    ultimaManutencao: parseDateTimeBrazil(body?.ultimaManutencao),
    cep: sanitizeDigits(body?.cep),
    logradouro: sanitizeOptionalText(body?.logradouro),
    numero: sanitizeOptionalText(body?.numero),
    complemento: sanitizeOptionalText(body?.complemento),
    bairro: sanitizeOptionalText(body?.bairro),
    cidade: sanitizeOptionalText(body?.cidade),
    estado: sanitizeOptionalText(body?.estado),
    telefoneCondominio: sanitizeDigits(body?.telefoneCondominio),
    celularCondominio: sanitizeDigits(body?.celularCondominio),
    nomeSindico: sanitizeOptionalText(body?.nomeSindico ?? body?.sindicoNome),
    telefoneSindico: sanitizeDigits(body?.telefoneSindico ?? body?.sindicoTelefone ?? body?.sindicoWhatsapp),
    emailSindico: sanitizeOptionalText(body?.emailSindico ?? body?.sindicoEmail),
    dataAniversarioSindico: parseDateOnlySafe(body?.sindicoAniversario),
    dataInicioMandato: parseDateOnlySafe(body?.dataInicioMandato),
    dataFimMandato: parseDateOnlySafe(body?.dataFimMandato),
    nomePorteiro: sanitizeOptionalText(body?.nomePorteiro ?? body?.porteiroNome),
    telefonePorteiro: sanitizeDigits(body?.telefonePorteiro ?? body?.porteiroTelefone),
    quantidadeSPDA: quantidadeSPDA ? Number.parseInt(String(quantidadeSPDA), 10) || null : null,
    quantidadeAndares: quantidadeAndares ? Number.parseInt(String(quantidadeAndares), 10) || null : null,
    especificacaoCondominio: parseEspecificacaoCondominio(body?.especificacaoCondominio),
    ...(administradoraId ? { administradora: { connect: { id: administradoraId } } } : {}),
    administradoraStringAntigo: sanitizeOptionalText(body?.administradoraStringAntigo),
    observacao: sanitizeOptionalText(body?.observacoes ?? body?.observacao),
  }

  // Campos adicionais seguros para null
  if (body?.dataContatoAgendado) {
    const parsed = parseDateOnlySafe(body.dataContatoAgendado)
    if (parsed) {
      data.dataContatoAgendado = parsed
    }
  }

  return { ok: true, data }
}

// Estrutura mínima usada para mapear Ficha -> Client
export type FichaLike = {
  razaoSocial: string | null
  ultimaManutencao: Date | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  estado: string | null
  cidade: string | null
  telefoneCondominio: string | null
  celularCondominio: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  dataInicioMandato: Date | null
  dataFimMandato: Date | null
  dataAniversarioSindico: Date | null
  emailSindico: string | null
  nomePorteiro: string | null
  telefonePorteiro: string | null
  quantidadeSPDA: number | null
  quantidadeAndares: number | null
  especificacaoCondominio: string | null
  observacao: string | null
  dataContatoAgendado: Date | null
  administradoraId: number | null
}

/**
 * Mapeia dados de ficha já carregada do banco para o payload de Client.
 * Não inclui CNPJ (definido na criação, se necessário).
 */
export function mapFichaToClientData(ficha: FichaLike): Omit<Prisma.ClientCreateInput, "cnpj"> {
  return {
    razaoSocial: ficha.razaoSocial ?? "Sem razão social",
    ultimaManutencao: ficha.ultimaManutencao,
    cep: ficha.cep,
    logradouro: ficha.logradouro,
    numero: ficha.numero,
    complemento: ficha.complemento,
    bairro: ficha.bairro,
    estado: ficha.estado,
    cidade: ficha.cidade,
    telefoneCondominio: ficha.telefoneCondominio,
    celularCondominio: ficha.celularCondominio,
    nomeSindico: ficha.nomeSindico,
    telefoneSindico: ficha.telefoneSindico,
    dataInicioMandato: ficha.dataInicioMandato,
    dataFimMandato: ficha.dataFimMandato,
    dataAniversarioSindico: ficha.dataAniversarioSindico,
    emailSindico: ficha.emailSindico,
    nomePorteiro: ficha.nomePorteiro,
    telefonePorteiro: ficha.telefonePorteiro,
    quantidadeSPDA: ficha.quantidadeSPDA,
    quantidadeAndares: ficha.quantidadeAndares,
    especificacaoCondominio: parseEspecificacaoCondominio(ficha.especificacaoCondominio),
    observacao: ficha.observacao,
    dataContatoAgendado: ficha.dataContatoAgendado,
    ...(ficha.administradoraId ? { administradora: { connect: { id: ficha.administradoraId } } } : {}),
    categoria: "EXPLORADO",
  }
}

type UpdateBuildError = { message: string; status: number }

type UpdateBuildResult =
  | { ok: true; data: Prisma.ClientUpdateInput }
  | { ok: false; error: UpdateBuildError }

/**
 * Constrói o payload para atualização de Client a partir do body cru.
 * Apenas campos presentes no body são incluídos no update (partial update).
 * 
 * Nota: administradoraId e vendedorId são retornados como valores simples.
 * A rota deve converter para connect/disconnect conforme necessário.
 */
export function buildClientUpdateData(body: any): UpdateBuildResult {
  const updateData: Prisma.ClientUpdateInput = {}

  // CNPJ - validar e formatar se presente
  if (body.cnpj !== undefined) {
    try {
      updateData.cnpj = formatCnpjForDatabase(body.cnpj)
    } catch {
      return { ok: false, error: { message: "CNPJ inválido", status: 400 } }
    }
  }

  // Campos texto simples
  if (body.razaoSocial !== undefined) {
    updateData.razaoSocial = sanitizeOptionalText(body.razaoSocial) ?? undefined
  }
  if (body.logradouro !== undefined) updateData.logradouro = sanitizeOptionalText(body.logradouro)
  if (body.numero !== undefined) updateData.numero = sanitizeOptionalText(body.numero)
  if (body.complemento !== undefined) updateData.complemento = sanitizeOptionalText(body.complemento)
  if (body.bairro !== undefined) updateData.bairro = sanitizeOptionalText(body.bairro)
  if (body.cidade !== undefined) updateData.cidade = sanitizeOptionalText(body.cidade)
  if (body.estado !== undefined) updateData.estado = sanitizeOptionalText(body.estado)
  if (body.nomeSindico !== undefined) updateData.nomeSindico = sanitizeOptionalText(body.nomeSindico)
  if (body.emailSindico !== undefined) updateData.emailSindico = sanitizeOptionalText(body.emailSindico)
  if (body.nomePorteiro !== undefined) updateData.nomePorteiro = sanitizeOptionalText(body.nomePorteiro)
  if (body.observacao !== undefined) updateData.observacao = sanitizeOptionalText(body.observacao)

  // Campos de dígitos
  if (body.cep !== undefined) updateData.cep = sanitizeDigits(body.cep)
  if (body.telefoneCondominio !== undefined) updateData.telefoneCondominio = sanitizeDigits(body.telefoneCondominio)
  if (body.celularCondominio !== undefined) updateData.celularCondominio = sanitizeDigits(body.celularCondominio)
  if (body.telefoneSindico !== undefined) updateData.telefoneSindico = sanitizeDigits(body.telefoneSindico)
  if (body.telefonePorteiro !== undefined) updateData.telefonePorteiro = sanitizeDigits(body.telefonePorteiro)

  // Datas "apenas dia" (safe noon)
  if (body.ultimaManutencao !== undefined) {
    // Não normaliza para "meio-dia": salva exatamente como veio.
    // Date-only vira 00:00 -03; ISO/timestamp preserva horário.
    updateData.ultimaManutencao = parseDateTimeBrazil(body.ultimaManutencao)
  }
  if (body.dataAniversarioSindico !== undefined) {
    updateData.dataAniversarioSindico = parseDateOnlySafe(body.dataAniversarioSindico)
  }
  if (body.dataInicioMandato !== undefined) {
    updateData.dataInicioMandato = parseDateOnlySafe(body.dataInicioMandato)
  }
  if (body.dataFimMandato !== undefined) {
    updateData.dataFimMandato = parseDateOnlySafe(body.dataFimMandato)
  }

  // Datas com hora (datetime)
  if (body.dataContatoAgendado !== undefined) {
    updateData.dataContatoAgendado = parseDateTimeBrazil(body.dataContatoAgendado)
  }

  // Inteiros
  if (body.quantidadeSPDA !== undefined) {
    updateData.quantidadeSPDA =
      body.quantidadeSPDA === null || body.quantidadeSPDA === ""
        ? null
        : parseOptionalInt(body.quantidadeSPDA)
  }
  if (body.quantidadeAndares !== undefined) {
    updateData.quantidadeAndares =
      body.quantidadeAndares === null || body.quantidadeAndares === ""
        ? null
        : parseOptionalInt(body.quantidadeAndares)
  }

  // Enum especificacaoCondominio
  if (body.especificacaoCondominio !== undefined) {
    updateData.especificacaoCondominio = parseEspecificacaoCondominio(body.especificacaoCondominio)
  }

  return { ok: true, data: updateData }
}

/**
 * Extrai administradoraId do body para uso em connect/disconnect.
 * Retorna: { shouldUpdate: false } se não veio no body,
 *          { shouldUpdate: true, value: number | null } se veio.
 */
export function extractAdministradoraId(body: any): { shouldUpdate: boolean; value?: number | null } {
  if (body.administradoraId === undefined) {
    return { shouldUpdate: false }
  }
  const value = body.administradoraId ? parseOptionalInt(body.administradoraId) : null
  return { shouldUpdate: true, value }
}

/**
 * Extrai vendedorId do body para uso em connect/disconnect.
 * Retorna: { shouldUpdate: false } se não veio no body,
 *          { shouldUpdate: true, value: string | null } se veio.
 */
export function extractVendedorId(body: any): { shouldUpdate: boolean; value?: string | null } {
  if (body.vendedorId === undefined) {
    return { shouldUpdate: false }
  }
  const value = body.vendedorId ? String(body.vendedorId) : null
  return { shouldUpdate: true, value }
}

