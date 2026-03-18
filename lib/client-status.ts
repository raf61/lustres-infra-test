/**
 * Meses para considerar um cliente como "renovado".
 * Cliente ATIVO com ultimaManutencao nos últimos X meses é renovado.
 */
export const MESES_RENOVADO = 3

export const getClienteVencimentoDate = (
  ultimaManutencao: Date | string | null | undefined
): Date | null => {
  if (!ultimaManutencao) return null
  const data = typeof ultimaManutencao === "string" ? new Date(ultimaManutencao) : ultimaManutencao
  return new Date(data.getFullYear() + 1, data.getMonth() + 1, 1)
}

export const isClienteVencido = (
  categoria: string | null | undefined,
  ultimaManutencao: Date | string | null | undefined
): boolean => {
  if (!categoria || String(categoria).toUpperCase() !== "ATIVO") return false
  const vencimentoDate = getClienteVencimentoDate(ultimaManutencao)
  if (!vencimentoDate) return false
  return new Date() > vencimentoDate
}

/**
 * Verifica se um cliente foi renovado recentemente
 * Critério: cliente ATIVO com ultimaManutencao nos últimos MESES_RENOVADO meses
 */
export const isClienteRenovado = (ultimaManutencao: Date | string | null | undefined): boolean => {
  if (!ultimaManutencao) return false
  const dataUltimaManutencao = typeof ultimaManutencao === 'string'
    ? new Date(ultimaManutencao)
    : ultimaManutencao
  const now = new Date()
  const limiteRenovado = new Date(now.getFullYear(), now.getMonth() - MESES_RENOVADO, 1)
  return dataUltimaManutencao >= limiteRenovado
}
