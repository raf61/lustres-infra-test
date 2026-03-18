-- CreateTable
CREATE TABLE "GerenteAdministradoraFicha" (
    "id" SERIAL NOT NULL,
    "fichaId" INTEGER NOT NULL,
    "gerenteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GerenteAdministradoraFicha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GerenteAdministradoraFicha_fichaId_idx" ON "GerenteAdministradoraFicha"("fichaId");

-- CreateIndex
CREATE INDEX "GerenteAdministradoraFicha_gerenteId_idx" ON "GerenteAdministradoraFicha"("gerenteId");

-- CreateIndex
CREATE UNIQUE INDEX "GerenteAdministradoraFicha_fichaId_gerenteId_key" ON "GerenteAdministradoraFicha"("fichaId", "gerenteId");

-- AddForeignKey
ALTER TABLE "GerenteAdministradoraFicha" ADD CONSTRAINT "GerenteAdministradoraFicha_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "Ficha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GerenteAdministradoraFicha" ADD CONSTRAINT "GerenteAdministradoraFicha_gerenteId_fkey" FOREIGN KEY ("gerenteId") REFERENCES "GerenteAdministradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
