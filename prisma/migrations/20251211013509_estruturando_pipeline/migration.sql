-- CreateEnum
CREATE TYPE "AnaliseCancelamentoTipo" AS ENUM ('PRE_AGENDAMENTO', 'VISITA_AGENDADA', 'NAO_AUTORIZADO', 'AVULSO');

-- CreateEnum
CREATE TYPE "ListaExtraStatus" AS ENUM ('APROVADO', 'REJEITADO', 'PENDENTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PedidoStatus" ADD VALUE 'SAC';
ALTER TYPE "PedidoStatus" ADD VALUE 'AGUARDANDO_APROVACAO_SUPERVISAO';
ALTER TYPE "PedidoStatus" ADD VALUE 'AGUARDANDO_APROVACAO_FINAL';
ALTER TYPE "PedidoStatus" ADD VALUE 'ANALISE_CANCELAMENTO';

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "analiseCancelamentoTipo" "AnaliseCancelamentoTipo";

-- CreateTable
CREATE TABLE "ListaExtra" (
    "id" SERIAL NOT NULL,
    "visitaId" INTEGER NOT NULL,
    "status" "ListaExtraStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaExtraItem" (
    "id" SERIAL NOT NULL,
    "listaExtraId" INTEGER NOT NULL,
    "itemId" BIGINT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaExtraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListaExtra_visitaId_idx" ON "ListaExtra"("visitaId");

-- CreateIndex
CREATE INDEX "ListaExtraItem_listaExtraId_idx" ON "ListaExtraItem"("listaExtraId");

-- CreateIndex
CREATE INDEX "ListaExtraItem_itemId_idx" ON "ListaExtraItem"("itemId");

-- AddForeignKey
ALTER TABLE "ListaExtra" ADD CONSTRAINT "ListaExtra_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "VisitaTecnica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaExtraItem" ADD CONSTRAINT "ListaExtraItem_listaExtraId_fkey" FOREIGN KEY ("listaExtraId") REFERENCES "ListaExtra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaExtraItem" ADD CONSTRAINT "ListaExtraItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
