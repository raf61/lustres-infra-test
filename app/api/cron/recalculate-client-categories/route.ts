import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const isAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get("x-cron-secret") || request.headers.get("authorization")
  return header === secret || header === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  console.info("[cron/recalculate-client-categories] Iniciando recalculo de categorias e ultimaManutencao...")

  try {
    const updatedCount = await prisma.$transaction(async (tx) => {
      const intervalo = Prisma.raw(`'${13} months'`)
      const limiteSql = Prisma.sql`(date_trunc('month', current_timestamp) - interval ${intervalo})`
      return tx.$executeRaw`
        WITH pedido_stats AS (
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
              WHEN pedido_stats.last_order_date_recent IS NOT NULL
                AND (
                  c."ultimaManutencao" IS NULL
                  OR pedido_stats.last_order_date_recent >= c."ultimaManutencao"
                )
                THEN 'ATIVO'::"ClientCategoria"
              WHEN c."ultimaManutencao" IS NOT NULL
                AND c."ultimaManutencao" >= ${limiteSql}
                THEN 'AGENDADO'::"ClientCategoria"
              ELSE 'EXPLORADO'::"ClientCategoria"
            END AS categoria,
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
    })

    const durationMs = Date.now() - start
    console.info(
      `[cron/recalculate-client-categories] Concluído. Clientes atualizados: ${updatedCount}. Tempo: ${durationMs}ms`
    )

    return NextResponse.json({
      ok: true,
      updated: Number(updatedCount),
      durationMs,
    })
  } catch (error) {
    console.error("[cron/recalculate-client-categories] Erro:", error)
    const message = error instanceof Error ? error.message : "Erro ao recalcular categorias."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

