-- CreateEnum
CREATE TYPE "FichaStatus" AS ENUM ('EM_PESQUISA', 'FINALIZADA');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "vendedorAlocadoEm" DATE;

-- AlterTable
ALTER TABLE "Ficha" ADD COLUMN     "fichaStatus" "FichaStatus" NOT NULL DEFAULT 'EM_PESQUISA';
