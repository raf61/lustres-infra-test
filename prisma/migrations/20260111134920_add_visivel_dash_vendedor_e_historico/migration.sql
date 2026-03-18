-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "historicoVendedor" JSONB,
ADD COLUMN     "visivelDashVendedor" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Client_visivelDashVendedor_idx" ON "Client"("visivelDashVendedor");
