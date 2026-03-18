/**
 * Regras de categorização de clientes.
 * 
 * Este módulo centraliza TODAS as regras de como um cliente é categorizado.
 * Se você precisar mudar os critérios de categorização, altere apenas aqui.
 * 
 * CATEGORIAS:
 * - ATIVO: Cliente que fez manutenção conosco recentemente
 * - AGENDADO: Cliente que fez manutenção com concorrente recentemente (tem ultimaManutencao)
 * - EXPLORADO: Cliente sem manutenção recente (nem conosco nem com concorrente)
 */

import { Prisma } from "@prisma/client"

// ============================================================================
// CONFIGURAÇÃO - Modifique estes valores para alterar os critérios
// ============================================================================

/**
 * Quantidade de meses para considerar um cliente como "ativo" ou "agendado".
 * Cliente com pedido/manutenção nos últimos X meses é considerado relevante.
 */
export const MESES_RELEVANCIA = 13

// ============================================================================
// TIPOS
// ============================================================================

export type ClientCategoria = "ATIVO" | "AGENDADO" | "EXPLORADO"

export type ClientCategoryInput = {
  ultimoPedidoData: Date | null
  ultimaManutencao: Date | null
  totalPedidos: number
}

// ============================================================================
// FUNÇÕES DE CÁLCULO DE CATEGORIA
// ============================================================================

/**
 * Calcula a data limite para considerar um registro como "recente".
 * Retorna o primeiro dia do mês de X meses atrás.
 */
export function calcularDataLimiteRelevancia(meses: number = MESES_RELEVANCIA): Date {
  const now = new Date()
  const limite = new Date(now.getFullYear(), now.getMonth(), 1)
  limite.setMonth(limite.getMonth() - meses)
  return limite
}

/**
 * Determina se um cliente é ATIVO.
 * 
 * Regras:
 * 1. Tem pedido nos últimos 13 meses
 * 2. A data do último pedido é >= ultimaManutencao do cliente
 *    (isso garante que a manutenção conosco é a mais recente)
 */
export function isClienteAtivo(input: ClientCategoryInput): boolean {
  const { ultimoPedidoData, ultimaManutencao } = input
  
  // Se não tem pedido, não é ativo
  if (!ultimoPedidoData) {
    return false
  }
  
  const dataLimite = calcularDataLimiteRelevancia()
  
  // Pedido precisa ser a partir do início do mês limite (janela por mês)
  if (ultimoPedidoData < dataLimite) {
    return false
  }
  
  // Se tem ultimaManutencao, o pedido precisa ser >= a ela
  // (se ultimaManutencao for mais recente que o pedido, o cliente
  // fez manutenção com concorrente depois de fazer conosco)
  if (ultimaManutencao && ultimoPedidoData < ultimaManutencao) {
    return false
  }
  
  return true
}

/**
 * Determina se um cliente é AGENDADO (livres com data).
 * 
 * Regras:
 * 1. Não é ATIVO
 * 2. Tem ultimaManutencao nos últimos 13 meses
 *    (manutenção feita com concorrente)
 */
export function isClienteAgendado(input: ClientCategoryInput): boolean {
  // Se é ativo, não pode ser agendado
  if (isClienteAtivo(input)) {
    return false
  }
  
  const { ultimaManutencao } = input
  
  // Precisa ter ultimaManutencao
  if (!ultimaManutencao) {
    return false
  }
  
  const dataLimite = calcularDataLimiteRelevancia()
  
  // ultimaManutencao precisa ser a partir do início do mês limite (janela por mês)
  return ultimaManutencao >= dataLimite
}

/**
 * Calcula a categoria de um cliente.
 * 
 * Ordem de prioridade:
 * 1. ATIVO (manutenção conosco recente)
 * 2. AGENDADO (manutenção com concorrente recente)
 * 3. EXPLORADO (nenhuma manutenção recente)
 */
export function calcularCategoria(input: ClientCategoryInput): ClientCategoria {
  if (isClienteAtivo(input)) {
    return "ATIVO"
  }
  
  if (isClienteAgendado(input)) {
    return "AGENDADO"
  }
  
  return "EXPLORADO"
}

// ============================================================================
// SQL BUILDERS - Para usar em queries raw do Prisma
// ============================================================================

/**
 * Condição SQL para ATIVO.
 * Use em queries $queryRaw.
 */
export function buildAtivoConditionSql(): Prisma.Sql {
  // Construir o intervalo como string fixa para evitar problemas com template literal
  const intervalo = Prisma.raw(`'${MESES_RELEVANCIA} months'`)
  const limiteSql = Prisma.sql`(date_trunc('month', current_timestamp) - interval ${intervalo})`
  
  return Prisma.sql`
    -- Cliente é ATIVO se:
    -- 1. Tem pedido NÃO CANCELADO nos últimos 13 meses
    -- 2. Data do último pedido >= ultimaManutencao (ou ultimaManutencao é null)
    EXISTS (
      SELECT 1 FROM "Pedido" p
      INNER JOIN "Orcamento" o ON o."id" = p."orcamentoId"
      WHERE o."clienteId" = c."id"
      AND p."status" != 'CANCELADO'
      AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      AND p."createdAt" >= ${limiteSql}
      AND (
        c."ultimaManutencao" IS NULL 
        OR p."createdAt" >= c."ultimaManutencao"
      )
    )
  `
}

/**
 * Condição SQL para AGENDADO (livres com data).
 * Use em queries $queryRaw.
 */
export function buildAgendadoConditionSql(): Prisma.Sql {
  // Construir o intervalo como string fixa para evitar problemas com template literal
  const intervalo = Prisma.raw(`'${MESES_RELEVANCIA} months'`)
  const limiteSql = Prisma.sql`(date_trunc('month', current_timestamp) - interval ${intervalo})`
  
  return Prisma.sql`
    -- Cliente é AGENDADO se:
    -- 1. Não é ATIVO (não tem pedido NÃO CANCELADO recente que seja >= ultimaManutencao)
    -- 2. Tem ultimaManutencao nos últimos 13 meses
    NOT EXISTS (
      SELECT 1 FROM "Pedido" p
      INNER JOIN "Orcamento" o ON o."id" = p."orcamentoId"
      WHERE o."clienteId" = c."id"
      AND p."status" != 'CANCELADO'
      AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      AND p."createdAt" >= ${limiteSql}
      AND (
        c."ultimaManutencao" IS NULL 
        OR p."createdAt" >= c."ultimaManutencao"
      )
    )
    AND c."ultimaManutencao" IS NOT NULL
    AND c."ultimaManutencao" >= ${limiteSql}
  `
}

/**
 * Condição SQL para EXPLORADO (livres sem data).
 * Use em queries $queryRaw.
 */
export function buildExploradoConditionSql(): Prisma.Sql {
  // Construir o intervalo como string fixa para evitar problemas com template literal
  const intervalo = Prisma.raw(`'${MESES_RELEVANCIA} months'`)
  const limiteSql = Prisma.sql`(date_trunc('month', current_timestamp) - interval ${intervalo})`
  
  return Prisma.sql`
    -- Cliente é EXPLORADO se:
    -- 1. Não é ATIVO (não tem pedido NÃO CANCELADO recente)
    -- 2. Não é AGENDADO (não tem ultimaManutencao recente)
    NOT EXISTS (
      SELECT 1 FROM "Pedido" p
      INNER JOIN "Orcamento" o ON o."id" = p."orcamentoId"
      WHERE o."clienteId" = c."id"
      AND p."status" != 'CANCELADO'
      AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      AND p."createdAt" >= ${limiteSql}
      AND (
        c."ultimaManutencao" IS NULL 
        OR p."createdAt" >= c."ultimaManutencao"
      )
    )
    AND (
      c."ultimaManutencao" IS NULL
      OR c."ultimaManutencao" < ${limiteSql}
    )
  `
}

