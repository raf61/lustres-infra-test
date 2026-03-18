/*
  Warnings:

  - Added the required column `clienteId` to the `VisitaTecnica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orcamentoId` to the `VisitaTecnica` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VisitaTecnica" ADD COLUMN     "clienteId" INTEGER NOT NULL,
ADD COLUMN     "orcamentoId" INTEGER NOT NULL,
ALTER COLUMN "pedidoId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "VisitaTecnica_orcamentoId_idx" ON "VisitaTecnica"("orcamentoId");

-- CreateIndex
CREATE INDEX "VisitaTecnica_clienteId_idx" ON "VisitaTecnica"("clienteId");

-- AddForeignKey
ALTER TABLE "VisitaTecnica" ADD CONSTRAINT "VisitaTecnica_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaTecnica" ADD CONSTRAINT "VisitaTecnica_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
