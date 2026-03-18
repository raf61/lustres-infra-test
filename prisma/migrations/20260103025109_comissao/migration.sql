-- CreateTable
CREATE TABLE "Comissao" (
    "id" INTEGER NOT NULL,
    "createdAt" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "pagamento" TIMESTAMP(3),

    CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comissao_pedidoId_idx" ON "Comissao"("pedidoId");

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
