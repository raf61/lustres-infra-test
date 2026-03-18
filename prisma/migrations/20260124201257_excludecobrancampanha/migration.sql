/*
  Warnings:

  - You are about to drop the column `campanhaId` on the `CobrancaCampanhaEnvio` table. All the data in the column will be lost.
  - You are about to drop the `CobrancaCampanha` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[debitoId,ruleKey]` on the table `CobrancaCampanhaEnvio` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ruleKey` to the `CobrancaCampanhaEnvio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CobrancaCampanhaEnvio` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CobrancaCampanha" DROP CONSTRAINT "CobrancaCampanha_createdById_fkey";

-- DropForeignKey
ALTER TABLE "CobrancaCampanhaEnvio" DROP CONSTRAINT "CobrancaCampanhaEnvio_campanhaId_fkey";

-- DropIndex
DROP INDEX "CobrancaCampanhaEnvio_campanhaId_idx";

-- AlterTable
ALTER TABLE "CobrancaCampanhaEnvio" DROP COLUMN "campanhaId",
ADD COLUMN     "ruleKey" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL;

-- DropTable
DROP TABLE "CobrancaCampanha";

-- CreateIndex
CREATE INDEX "CobrancaCampanhaEnvio_ruleKey_idx" ON "CobrancaCampanhaEnvio"("ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "CobrancaCampanhaEnvio_debitoId_ruleKey_key" ON "CobrancaCampanhaEnvio"("debitoId", "ruleKey");
