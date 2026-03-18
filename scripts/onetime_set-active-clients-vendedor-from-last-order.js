/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  console.info("[set-active-clients-vendedor] Iniciando atualização...")

  const updatedCount = await prisma.$executeRaw`
    WITH last_orders AS (
      SELECT
        p."clienteId",
        p."vendedorId",
        ROW_NUMBER() OVER (PARTITION BY p."clienteId" ORDER BY p."createdAt" DESC) AS rn
      FROM "Pedido" p
      INNER JOIN "User" u ON u."id" = p."vendedorId" AND u."active" = TRUE
      WHERE p."status" != 'CANCELADO'
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."vendedorId" IS NOT NULL
    ),
    selected_orders AS (
      SELECT
        lo."clienteId",
        lo."vendedorId"
      FROM last_orders lo
      WHERE lo.rn = 1
    ),
    to_update AS (
      SELECT
        c."id" AS client_id,
        so."vendedorId" AS new_vendedor_id
      FROM "Client" c
      INNER JOIN selected_orders so ON so."clienteId" = c."id"
      WHERE c."categoria" = 'ATIVO'
        AND c."vendedorId" IS DISTINCT FROM so."vendedorId"
    )
    UPDATE "Client" AS c
    SET 
      "vendedorId" = to_update.new_vendedor_id,
      "vendedorAlocadoEm" = NOW()
    FROM to_update
    WHERE c."id" = to_update.client_id
  `

  console.info(
    `[set-active-clients-vendedor] Clientes ATIVOS atualizados: ${updatedCount}.`
  )

  // Remove vendedorId de clientes que NÃO são ativos
  const clearedCount = await prisma.$executeRaw`
    UPDATE "Client"
    SET 
      "vendedorId" = NULL,
      "vendedorAlocadoEm" = NULL
    WHERE "categoria" != 'ATIVO'
      AND "vendedorId" IS NOT NULL
  `

  console.info(
    `[set-active-clients-vendedor] Clientes NÃO-ATIVOS com vendedor removido: ${clearedCount}.`
  )

  console.info("[set-active-clients-vendedor] Concluído.")
}

main()
  .catch((error) => {
    console.error("[set-active-clients-vendedor] Erro ao atualizar:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

