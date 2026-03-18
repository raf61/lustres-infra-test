/**
 * Valores possíveis para EspecificacaoCondominio
 * Centralizado para uso em backend e frontend
 */

export const ESPECIFICACAO_CONDOMINIO_VALUES = ["COMERCIAL", "RESIDENCIAL", "MISTO"] as const

export type EspecificacaoCondominioType = (typeof ESPECIFICACAO_CONDOMINIO_VALUES)[number]

/**
 * Labels para exibição no frontend
 */
export const ESPECIFICACAO_CONDOMINIO_LABELS: Record<EspecificacaoCondominioType, string> = {
  COMERCIAL: "Comercial",
  RESIDENCIAL: "Residencial",
  MISTO: "Misto",
}

/**
 * Opções para select/dropdown (sem opção vazia - use placeholder do Select)
 */
export const ESPECIFICACAO_CONDOMINIO_OPTIONS = [
  { value: "RESIDENCIAL", label: "Residencial" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "MISTO", label: "Misto" },
] as const

/**
 * Parseia e valida um valor para o enum EspecificacaoCondominio
 * @returns O valor válido em uppercase ou null se inválido/vazio
 */
export function parseEspecificacaoCondominio(value: unknown): EspecificacaoCondominioType | null {
  if (value === null || value === undefined || value === "") return null
  const upper = String(value).toUpperCase().trim()
  if (ESPECIFICACAO_CONDOMINIO_VALUES.includes(upper as EspecificacaoCondominioType)) {
    return upper as EspecificacaoCondominioType
  }
  return null
}

/**
 * Retorna o label formatado para exibição
 */
export function getEspecificacaoCondominioLabel(value: EspecificacaoCondominioType | null | undefined): string {
  if (!value) return "—"
  return ESPECIFICACAO_CONDOMINIO_LABELS[value] ?? "—"
}

