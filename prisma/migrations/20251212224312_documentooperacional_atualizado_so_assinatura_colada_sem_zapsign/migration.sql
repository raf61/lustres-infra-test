/*
  Warnings:

  - You are about to drop the column `zapsignToken` on the `DocumentoOperacional` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DocumentoOperacional" DROP COLUMN "zapsignToken",
ADD COLUMN     "urlAssinatura" TEXT;
