-- CreateTable
CREATE TABLE "UserDadosCadastrais" (
    "id" INTEGER NOT NULL,
    "idUser" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "telefone" TEXT,
    "celular" TEXT,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "metaMin" DOUBLE PRECISION,
    "metaMinPerc" DOUBLE PRECISION,
    "metaNormal" DOUBLE PRECISION,
    "metaNormalPerc" DOUBLE PRECISION,
    "observacao" TEXT,

    CONSTRAINT "UserDadosCadastrais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDadosCadastrais_idUser_key" ON "UserDadosCadastrais"("idUser");

-- AddForeignKey
ALTER TABLE "UserDadosCadastrais" ADD CONSTRAINT "UserDadosCadastrais_idUser_fkey" FOREIGN KEY ("idUser") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
