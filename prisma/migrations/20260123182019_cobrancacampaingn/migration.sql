/*
  Warnings:

  - You are about to drop the column `templateComponents` on the `CobrancaCampanha` table. All the data in the column will be lost.
  - You are about to drop the column `templateLanguage` on the `CobrancaCampanha` table. All the data in the column will be lost.
  - You are about to drop the column `templateName` on the `CobrancaCampanha` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CobrancaCampanha" DROP COLUMN "templateComponents",
DROP COLUMN "templateLanguage",
DROP COLUMN "templateName";
