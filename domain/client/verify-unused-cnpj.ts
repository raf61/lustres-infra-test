
import { prisma } from "@/lib/prisma"
import { extractDigits } from "@/lib/cnpj"
import { Prisma } from "@prisma/client"

/**
 * Verifica se um CNPJ está na lista de bloqueados (unused_cnpjs).
 * A verificação é feita comparando apenas os dígitos, removendo pontuação
 * diretamente no banco de dados para garantir robustez.
 * 
 * @param cnpj CNPJ a ser verificado (com ou sem pontuação)
 * @returns true se o CNPJ estiver bloqueado, false caso contrário
 */
export async function verifyUnusedCnpj(cnpj: string): Promise<boolean> {
  const digits = extractDigits(cnpj)
  if (!digits) return false

  // Busca na tabela UnusedCnpjs onde comparamos apenas números.
  // Assumindo PostgreSQL, usamos REGEXP_REPLACE para limpar o campo do banco.
  // Se o banco fosse outro, a estratégia poderia ser diferente (ex: REPLACE repetido).

  // Nota: O campo UnusedCnpjs.cnpj pode estar formatado ou não. 
  // A query abaixo normaliza ambos os lados para garantir.

  const result = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int as count
    FROM "UnusedCnpjs"
    WHERE 
      REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = ${digits}
  `)


  const count = result[0]?.count ?? 0
  return count > 0
}
