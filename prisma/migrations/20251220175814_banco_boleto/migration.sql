-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "bancoEmissorId" INTEGER;

-- CreateTable
CREATE TABLE "Banco" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "bancoCodigo" INTEGER NOT NULL,
    "agencia" TEXT NOT NULL,
    "agenciaDigito" TEXT,
    "conta" TEXT NOT NULL,
    "contaDigito" TEXT,
    "carteira" TEXT NOT NULL,
    "codigoBeneficiario" TEXT,
    "codigoTransmissao" TEXT,
    "endereco" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Banco_nome_key" ON "Banco"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Banco_cnpj_bancoCodigo_agencia_conta_key" ON "Banco"("cnpj", "bancoCodigo", "agencia", "conta");

-- CreateIndex
CREATE INDEX "Pedido_bancoEmissorId_idx" ON "Pedido"("bancoEmissorId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_bancoEmissorId_fkey" FOREIGN KEY ("bancoEmissorId") REFERENCES "Banco"("id") ON DELETE SET NULL ON UPDATE CASCADE;
