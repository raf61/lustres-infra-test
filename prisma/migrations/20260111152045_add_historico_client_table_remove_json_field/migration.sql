/*
  Warnings:

  - You are about to drop the column `historicoVendedor` on the `Client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Client" DROP COLUMN "historicoVendedor";

-- CreateTable
CREATE TABLE "HistoricoClient" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "HistoricoClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoClient_clientId_idx" ON "HistoricoClient"("clientId");

-- CreateIndex
CREATE INDEX "HistoricoClient_vendedorId_idx" ON "HistoricoClient"("vendedorId");

-- CreateIndex
CREATE INDEX "HistoricoClient_type_idx" ON "HistoricoClient"("type");

-- CreateIndex
CREATE INDEX "HistoricoClient_createdAt_idx" ON "HistoricoClient"("createdAt");
