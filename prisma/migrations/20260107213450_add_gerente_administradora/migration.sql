/*
  Warnings:

  - The primary key for the `Administradora` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Administradora` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `administradoraId` column on the `Client` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `administradoraId` column on the `Ficha` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_administradoraId_fkey";

-- DropForeignKey
ALTER TABLE "Ficha" DROP CONSTRAINT "Ficha_administradoraId_fkey";

-- AlterTable
ALTER TABLE "Administradora" DROP CONSTRAINT "Administradora_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Administradora_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "administradoraId",
ADD COLUMN     "administradoraId" INTEGER;

-- AlterTable
ALTER TABLE "Ficha" DROP COLUMN "administradoraId",
ADD COLUMN     "administradoraId" INTEGER;

-- CreateTable
CREATE TABLE "GerenteAdministradora" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "celular" TEXT,
    "whatsapp" TEXT,
    "administradoraId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GerenteAdministradora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GerenteAdministradoraClient" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "gerenteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GerenteAdministradoraClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GerenteAdministradora_administradoraId_idx" ON "GerenteAdministradora"("administradoraId");

-- CreateIndex
CREATE INDEX "GerenteAdministradoraClient_clientId_idx" ON "GerenteAdministradoraClient"("clientId");

-- CreateIndex
CREATE INDEX "GerenteAdministradoraClient_gerenteId_idx" ON "GerenteAdministradoraClient"("gerenteId");

-- CreateIndex
CREATE UNIQUE INDEX "GerenteAdministradoraClient_clientId_gerenteId_key" ON "GerenteAdministradoraClient"("clientId", "gerenteId");

-- CreateIndex
CREATE INDEX "Client_administradoraId_idx" ON "Client"("administradoraId");

-- CreateIndex
CREATE INDEX "Ficha_administradoraId_idx" ON "Ficha"("administradoraId");

-- AddForeignKey
ALTER TABLE "GerenteAdministradora" ADD CONSTRAINT "GerenteAdministradora_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GerenteAdministradoraClient" ADD CONSTRAINT "GerenteAdministradoraClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GerenteAdministradoraClient" ADD CONSTRAINT "GerenteAdministradoraClient_gerenteId_fkey" FOREIGN KEY ("gerenteId") REFERENCES "GerenteAdministradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ficha" ADD CONSTRAINT "Ficha_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;
