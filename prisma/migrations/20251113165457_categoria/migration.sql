-- CreateEnum
CREATE TYPE "ClientCategoria" AS ENUM ('ATIVO', 'AGENDADO', 'EXPLORADO');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "categoria" "ClientCategoria";
