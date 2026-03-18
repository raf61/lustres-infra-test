-- CreateTable
CREATE TABLE "ContaPagarCategoria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaPagarCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaPagar" (
    "id" SERIAL NOT NULL,
    "descricao" TEXT,
    "categoriaId" INTEGER,
    "valor" DOUBLE PRECISION NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "vencimento" DATE NOT NULL,
    "pagoEm" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaPagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContaPagarCategoria_nome_key" ON "ContaPagarCategoria"("nome");

-- CreateIndex
CREATE INDEX "ContaPagar_categoriaId_idx" ON "ContaPagar"("categoriaId");

-- CreateIndex
CREATE INDEX "ContaPagar_status_idx" ON "ContaPagar"("status");

-- CreateIndex
CREATE INDEX "ContaPagar_vencimento_idx" ON "ContaPagar"("vencimento");

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "ContaPagarCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
