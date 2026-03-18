/*
  Warnings:

  - Changed the type of `dadosCadastrais` on the `Filial` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Filial" DROP COLUMN "dadosCadastrais",
ADD COLUMN     "dadosCadastrais" JSONB NOT NULL;
