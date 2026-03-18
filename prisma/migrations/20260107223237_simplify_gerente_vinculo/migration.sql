/*
  Warnings:

  - You are about to drop the `GerenteAdministradoraClient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GerenteAdministradoraFicha` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GerenteAdministradoraClient" DROP CONSTRAINT "GerenteAdministradoraClient_clientId_fkey";

-- DropForeignKey
ALTER TABLE "GerenteAdministradoraClient" DROP CONSTRAINT "GerenteAdministradoraClient_gerenteId_fkey";

-- DropForeignKey
ALTER TABLE "GerenteAdministradoraFicha" DROP CONSTRAINT "GerenteAdministradoraFicha_fichaId_fkey";

-- DropForeignKey
ALTER TABLE "GerenteAdministradoraFicha" DROP CONSTRAINT "GerenteAdministradoraFicha_gerenteId_fkey";

-- DropTable
DROP TABLE "GerenteAdministradoraClient";

-- DropTable
DROP TABLE "GerenteAdministradoraFicha";

-- CreateTable
CREATE TABLE "GerenteAdministradoraVinculo" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER,
    "fichaId" INTEGER,
    "gerenteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GerenteAdministradoraVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GerenteAdministradoraVinculo_clientId_idx" ON "GerenteAdministradoraVinculo"("clientId");

-- CreateIndex
CREATE INDEX "GerenteAdministradoraVinculo_fichaId_idx" ON "GerenteAdministradoraVinculo"("fichaId");

-- CreateIndex
CREATE INDEX "GerenteAdministradoraVinculo_gerenteId_idx" ON "GerenteAdministradoraVinculo"("gerenteId");

-- CreateIndex
CREATE UNIQUE INDEX "GerenteAdministradoraVinculo_clientId_gerenteId_key" ON "GerenteAdministradoraVinculo"("clientId", "gerenteId");

-- CreateIndex
CREATE UNIQUE INDEX "GerenteAdministradoraVinculo_fichaId_gerenteId_key" ON "GerenteAdministradoraVinculo"("fichaId", "gerenteId");

-- AddForeignKey
ALTER TABLE "GerenteAdministradoraVinculo" ADD CONSTRAINT "GerenteAdministradoraVinculo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GerenteAdministradoraVinculo" ADD CONSTRAINT "GerenteAdministradoraVinculo_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "Ficha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GerenteAdministradoraVinculo" ADD CONSTRAINT "GerenteAdministradoraVinculo_gerenteId_fkey" FOREIGN KEY ("gerenteId") REFERENCES "GerenteAdministradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
