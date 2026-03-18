/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UserLancamento` table. All the data in the column will be lost.
  - Added the required column `data` to the `UserLancamento` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserLancamento" DROP COLUMN "createdAt",
ADD COLUMN     "data" DATE NOT NULL;
