/*
  Warnings:

  - Changed the type of `remessa` on the `Debito` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Debito" DROP COLUMN "remessa",
ADD COLUMN     "remessa" BOOLEAN NOT NULL;
