-- CreateTable
CREATE TABLE "OrcamentoItem" (
    "id" SERIAL NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "itemId" BIGINT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrcamentoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrcamentoItem_orcamentoId_idx" ON "OrcamentoItem"("orcamentoId");

-- CreateIndex
CREATE INDEX "OrcamentoItem_itemId_idx" ON "OrcamentoItem"("itemId");

-- AddForeignKey
ALTER TABLE "OrcamentoItem" ADD CONSTRAINT "OrcamentoItem_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrcamentoItem" ADD CONSTRAINT "OrcamentoItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
