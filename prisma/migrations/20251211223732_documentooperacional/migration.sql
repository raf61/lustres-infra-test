-- CreateEnum
CREATE TYPE "DocumentoOperacionalTipo" AS ENUM ('RELATORIO_VISTORIA', 'TERMO_CONCLUSAO');

-- CreateEnum
CREATE TYPE "DocumentoOperacionalStatus" AS ENUM ('PENDENTE', 'COMPLETO');

-- CreateTable
CREATE TABLE "DocumentoOperacional" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "tipo" "DocumentoOperacionalTipo" NOT NULL,
    "zapsignToken" TEXT NOT NULL,
    "status" "DocumentoOperacionalStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT,

    CONSTRAINT "DocumentoOperacional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoOperacional_pedidoId_idx" ON "DocumentoOperacional"("pedidoId");

-- AddForeignKey
ALTER TABLE "DocumentoOperacional" ADD CONSTRAINT "DocumentoOperacional_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
