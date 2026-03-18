-- CreateEnum
CREATE TYPE "EspecificacaoCondominio" AS ENUM ('COMERCIAL', 'RESIDENCIAL', 'MISTO');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "especificacaoCondominio" "EspecificacaoCondominio";

-- AlterTable
ALTER TABLE "Ficha" ADD COLUMN     "especificacaoCondominio" "EspecificacaoCondominio";
