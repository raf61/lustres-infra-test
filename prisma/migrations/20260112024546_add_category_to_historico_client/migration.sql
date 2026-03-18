-- AlterTable
ALTER TABLE "HistoricoClient" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "HistoricoClient_category_idx" ON "HistoricoClient"("category");
