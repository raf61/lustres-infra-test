-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filial" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "cnpj" TEXT NOT NULL,

    CONSTRAINT "Filial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nome_key" ON "Empresa"("nome");

-- CreateIndex
CREATE INDEX "Filial_empresaId_idx" ON "Filial"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Filial_cnpj_key" ON "Filial"("cnpj");

-- AddForeignKey
ALTER TABLE "Filial" ADD CONSTRAINT "Filial_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
