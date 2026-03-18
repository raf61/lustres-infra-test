/*
  Warnings:

  - Added the required column `uf` to the `Filial` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Filial" ADD COLUMN     "uf" TEXT NOT NULL;
