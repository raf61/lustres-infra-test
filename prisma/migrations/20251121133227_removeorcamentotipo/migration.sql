/*
  Warnings:

  - You are about to drop the column `tipo` on the `Orcamento` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Orcamento" DROP COLUMN "tipo";

-- DropEnum
DROP TYPE "OrcamentoTipo";
