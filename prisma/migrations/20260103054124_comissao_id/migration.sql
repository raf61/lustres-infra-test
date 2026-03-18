/*
  Warnings:

  - You are about to drop the column `pagamento` on the `Comissao` table. All the data in the column will be lost.
  - You are about to drop the column `pago` on the `Comissao` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[comissaoId]` on the table `ContaPagar` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Comissao" DROP COLUMN "pagamento",
DROP COLUMN "pago";

-- AlterTable
ALTER TABLE "ContaPagar" ADD COLUMN     "comissaoId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ContaPagar_comissaoId_key" ON "ContaPagar"("comissaoId");

-- CreateIndex
CREATE INDEX "ContaPagar_comissaoId_idx" ON "ContaPagar"("comissaoId");

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_comissaoId_fkey" FOREIGN KEY ("comissaoId") REFERENCES "Comissao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
