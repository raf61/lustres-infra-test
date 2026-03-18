-- AlterTable
ALTER TABLE "Orcamento" ADD COLUMN     "empresaId" INTEGER,
ADD COLUMN     "filialId" INTEGER;

-- CreateIndex
CREATE INDEX "Orcamento_empresaId_idx" ON "Orcamento"("empresaId");

-- CreateIndex
CREATE INDEX "Orcamento_filialId_idx" ON "Orcamento"("filialId");

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
