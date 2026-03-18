-- CreateEnum
CREATE TYPE "OrcamentoTipo" AS ENUM ('VISTORIADO', 'ORCAMENTO');

-- CreateEnum
CREATE TYPE "OrcamentoStatus" AS ENUM ('EM_ABERTO', 'APROVADO', 'REPROVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PedidoStatus" AS ENUM ('AGUARDANDO', 'AGENDADO_OU_EXECUCAO', 'CONCLUIDO');

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "tipo" "OrcamentoTipo" DEFAULT 'ORCAMENTO',
    "status" "OrcamentoStatus" NOT NULL DEFAULT 'EM_ABERTO',
    "parcelas" INTEGER,
    "primeiroVencimento" TIMESTAMP(3),
    "observacoes" TEXT,
    "anexo" TEXT,
    "vendedorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "status" "PedidoStatus" NOT NULL DEFAULT 'AGUARDANDO',
    "observacoes" TEXT,
    "vendedorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Orcamento_clienteId_idx" ON "Orcamento"("clienteId");

-- CreateIndex
CREATE INDEX "Orcamento_vendedorId_idx" ON "Orcamento"("vendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_orcamentoId_key" ON "Pedido"("orcamentoId");

-- CreateIndex
CREATE INDEX "Pedido_vendedorId_idx" ON "Pedido"("vendedorId");

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
