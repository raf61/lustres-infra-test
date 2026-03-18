/*
  Warnings:

  - Added the required column `inscricao_municipal` to the `Filial` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Filial" ADD COLUMN     "inscricao_municipal" TEXT NOT NULL;
