/*
  Warnings:

  - Changed the type of `tipo` on the `FichaLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FichaLogTipo" AS ENUM ('ENVIADO', 'RETORNADO');

-- AlterTable
ALTER TABLE "FichaLog" DROP COLUMN "tipo",
ADD COLUMN     "tipo" "FichaLogTipo" NOT NULL;
