-- CreateTable
CREATE TABLE "Administradora" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Administradora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "ultimaManutencao" TIMESTAMP(3),
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "estado" TEXT,
    "cidade" TEXT,
    "telefoneCondominio" TEXT,
    "nomeSindico" TEXT,
    "telefoneSindico" TEXT,
    "dataFimMandato" TIMESTAMP(3),
    "dataAniversarioSindico" TIMESTAMP(3),
    "emailSindico" TEXT,
    "nomePorteiro" TEXT,
    "telefonePorteiro" TEXT,
    "quantidadeSPDA" INTEGER,
    "administradoraStringAntigo" TEXT,
    "observacao" TEXT,
    "administradoraId" TEXT,
    "vendedorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Administradora_cnpj_key" ON "Administradora"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Client_cnpj_key" ON "Client"("cnpj");

-- CreateIndex
CREATE INDEX "Client_vendedorId_idx" ON "Client"("vendedorId");

-- CreateIndex
CREATE INDEX "Client_administradoraId_idx" ON "Client"("administradoraId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
