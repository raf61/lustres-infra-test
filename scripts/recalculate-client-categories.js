const { PrismaClient, Prisma } = require("@prisma/client")

const prisma = new PrismaClient()

/**
 * Quantidade de meses para considerar um cliente como "ativo" ou "agendado".
 * IMPORTANTE: Mantenha sincronizado com domain/client/category-rules.ts
 */
const MESES_RELEVANCIA = 13

async function main() {
  console.info("[recalculate-client-categories] Iniciando recalculo de categorias e ultimaManutencao...")

  const start = Date.now()
  
  /**
   * Nova lógica de categorização:
   * 
   * ATIVO: 
   *   - Tem pedido nos últimos 13 meses
   *   - A data do último pedido >= ultimaManutencao (ou ultimaManutencao é null)
   * 
   * AGENDADO (Livres com Data):
   *   - Não é ativo
   *   - Tem ultimaManutencao nos últimos 13 meses
   * 
   * EXPLORADO (Livres sem Data):
   *   - Nem ativo nem agendado
   */
  
  // Usar Prisma.raw para construir o intervalo corretamente
  const intervalo = Prisma.raw(`'${MESES_RELEVANCIA} months'`)
  const limiteSql = Prisma.sql`(date_trunc('month', current_timestamp) - interval ${intervalo})`
  
  const updatedCount = await prisma.$executeRaw`
    WITH pedido_stats AS (
      -- IMPORTANTE: Considerar apenas pedidos NÃO CANCELADOS
      SELECT
        o."clienteId" AS client_id,
        MAX(p."createdAt") AS last_order_date,
        MAX(p."createdAt") FILTER (
          WHERE p."createdAt" >= ${limiteSql}
        ) AS last_order_date_recent
      FROM "Pedido" p
      INNER JOIN "Orcamento" o ON o."id" = p."orcamentoId"
      WHERE p."status" != 'CANCELADO'
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
      GROUP BY o."clienteId"
    ),
    categorias_calculadas AS (
      SELECT
        c."id",
        CASE
          -- ATIVO: Tem pedido recente E (ultimaManutencao é null OU pedido >= ultimaManutencao)
          WHEN pedido_stats.last_order_date_recent IS NOT NULL
            AND (
              c."ultimaManutencao" IS NULL 
              OR pedido_stats.last_order_date_recent >= c."ultimaManutencao"
            )
            THEN 'ATIVO'::"ClientCategoria"
          
          -- AGENDADO: Não é ativo E tem ultimaManutencao a partir do mês limite
          WHEN c."ultimaManutencao" IS NOT NULL
            AND c."ultimaManutencao" >= ${limiteSql}
            THEN 'AGENDADO'::"ClientCategoria"
          
          -- EXPLORADO: Todo cliente que não é ativo nem agendado
          ELSE 'EXPLORADO'::"ClientCategoria"
        END AS categoria,
        
        -- Atualizar ultimaManutencao:
        -- Se tem pedido recente E (não tem ultimaManutencao OU ultimaManutencao < data do pedido)
        -- Então usar a data do último pedido
        CASE
          WHEN pedido_stats.last_order_date_recent IS NOT NULL
            AND (c."ultimaManutencao" IS NULL OR c."ultimaManutencao" < pedido_stats.last_order_date_recent)
            THEN pedido_stats.last_order_date_recent
          ELSE c."ultimaManutencao"
        END AS nova_ultima_manutencao
      FROM "Client" c
      LEFT JOIN pedido_stats ON pedido_stats.client_id = c."id"
    )
    UPDATE "Client" AS c
    SET
      "categoria" = categorias_calculadas.categoria,
      "ultimaManutencao" = categorias_calculadas.nova_ultima_manutencao
    FROM categorias_calculadas
    WHERE categorias_calculadas.id = c."id"
  `

  const durationMs = Date.now() - start
  console.info(
    `[recalculate-client-categories] Concluído. Clientes atualizados (categoria e ultimaManutencao): ${updatedCount}. Tempo: ${durationMs}ms`
  )
}

main()
  .catch((error) => {
    console.error("[recalculate-client-categories] Erro ao recalcular categorias:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
