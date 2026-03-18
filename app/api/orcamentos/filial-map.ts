import { Prisma } from "@prisma/client"

// Mapeamento único de filial por empresa/UF. Fonte da verdade compartilhada.
export const FILIAL_MAP: Record<number, Record<string, string | null>> = {
  2: {
    AC: null,
    AL: "PE",
    AP: null,
    AM: null,
    BA: "PE",
    CE: "CE",
    DF: "RJ",
    ES: "RJ",
    GO: "RJ",
    MA: "CE",
    MT: "RJ",
    MS: "RJ",
    MG: "MG",
    PA: null,
    PB: "PE",
    PR: "PR",
    PE: "PE",
    PI: "CE",
    RJ: "RJ",
    RN: "CE",
    RO: null,
    RR: null,
    RS: "PR",
    SC: "PR",
    SE: "PE",
    SP: "SP",
    TO: null,
  },
  1: {
    AC: "DF",
    AL: "PE",
    AP: "DF",
    AM: "DF",
    BA: "PE",
    CE: "PE",
    DF: "DF",
    ES: "RJ",
    GO: "DF",
    MA: "PE",
    MT: "SP",
    MS: "SP",
    MG: "RJ",
    PA: "DF",
    PB: "PE",
    PR: "PR",
    PE: "PE",
    PI: "PE",
    RJ: "RJ",
    RN: "PE",
    RO: "DF",
    RR: "DF",
    RS: "PR",
    SC: "PR",
    SE: "PE",
    SP: "SP",
    TO: "DF",
  },
}

export const normalizeUf = (uf: unknown): string | null => {
  if (!uf || typeof uf !== "string") return null
  const trimmed = uf.trim().toUpperCase()
  return trimmed.length === 2 ? trimmed : null
}

export const resolveFilialId = async (
  tx: Prisma.TransactionClient,
  empresaId: number,
  clientUf: string | null,
): Promise<number | null> => {
  const normalizedUf = normalizeUf(clientUf)
  if (!normalizedUf) return null

  const map = FILIAL_MAP[empresaId]
  if (!map) return null

  const targetUf = map[normalizedUf]
  if (!targetUf) return null

  const filial = await tx.filial.findFirst({
    where: { empresaId, uf: targetUf },
    select: { id: true },
  })

  return filial?.id ?? null
}

