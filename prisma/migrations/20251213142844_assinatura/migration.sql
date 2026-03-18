/*
  Warnings:

  - You are about to drop the column `urlAssinatura` on the `DocumentoOperacional` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pedidoId,tipo]` on the table `DocumentoOperacional` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DocumentoOperacional" DROP COLUMN "urlAssinatura";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "fullname" TEXT;

-- CreateTable
CREATE TABLE "DocumentoOperacionalAssinatura" (
    "id" SERIAL NOT NULL,
    "documentoOperacionalId" INTEGER NOT NULL,
    "nomeCompletoAssinante" TEXT NOT NULL,
    "cpfAssinante" TEXT,
    "ip" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoOperacionalAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoOperacionalAssinatura_documentoOperacionalId_idx" ON "DocumentoOperacionalAssinatura"("documentoOperacionalId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoOperacional_pedidoId_tipo_key" ON "DocumentoOperacional"("pedidoId", "tipo");

-- AddForeignKey
ALTER TABLE "DocumentoOperacionalAssinatura" ADD CONSTRAINT "DocumentoOperacionalAssinatura_documentoOperacionalId_fkey" FOREIGN KEY ("documentoOperacionalId") REFERENCES "DocumentoOperacional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
