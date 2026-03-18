-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PESQUISADOR';

-- CreateTable
CREATE TABLE "Ficha" (
    "id" SERIAL NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "ultimaManutencao" TIMESTAMP(3),
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "estado" TEXT,
    "cidade" TEXT,
    "telefoneCondominio" TEXT,
    "celularCondominio" TEXT,
    "nomeSindico" TEXT,
    "telefoneSindico" TEXT,
    "dataInicioMandato" TIMESTAMP(3),
    "dataFimMandato" TIMESTAMP(3),
    "dataAniversarioSindico" TIMESTAMP(3),
    "emailSindico" TEXT,
    "nomePorteiro" TEXT,
    "telefonePorteiro" TEXT,
    "quantidadeSPDA" INTEGER,
    "observacao" TEXT,
    "dataContatoAgendado" TIMESTAMP(3),
    "administradoraId" TEXT,
    "pesquisadorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ficha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichaLog" (
    "id" SERIAL NOT NULL,
    "fichaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FichaLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ficha_cnpj_key" ON "Ficha"("cnpj");

-- CreateIndex
CREATE INDEX "Ficha_pesquisadorId_idx" ON "Ficha"("pesquisadorId");

-- CreateIndex
CREATE INDEX "Ficha_administradoraId_idx" ON "Ficha"("administradoraId");

-- CreateIndex
CREATE INDEX "FichaLog_fichaId_idx" ON "FichaLog"("fichaId");

-- CreateIndex
CREATE INDEX "FichaLog_userId_idx" ON "FichaLog"("userId");

-- AddForeignKey
ALTER TABLE "Ficha" ADD CONSTRAINT "Ficha_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ficha" ADD CONSTRAINT "Ficha_pesquisadorId_fkey" FOREIGN KEY ("pesquisadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaLog" ADD CONSTRAINT "FichaLog_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "Ficha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaLog" ADD CONSTRAINT "FichaLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
