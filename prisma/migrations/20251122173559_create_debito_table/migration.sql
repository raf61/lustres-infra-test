-- CreateTable
CREATE TABLE "Debito" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "receber" DOUBLE PRECISION NOT NULL,
    "dataOcorrencia" TIMESTAMP(3),
    "recebido" DOUBLE PRECISION,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "acrescimos" DOUBLE PRECISION,
    "descontos" DOUBLE PRECISION,
    "email" TEXT,
    "banCobrador" TEXT,
    "stats" INTEGER NOT NULL,
    "remessa" INTEGER NOT NULL,
    "linkBoleto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debito_pedidoId_idx" ON "Debito"("pedidoId");

-- CreateIndex
CREATE INDEX "Debito_clienteId_idx" ON "Debito"("clienteId");

-- AddForeignKey
ALTER TABLE "Debito" ADD CONSTRAINT "Debito_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debito" ADD CONSTRAINT "Debito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
