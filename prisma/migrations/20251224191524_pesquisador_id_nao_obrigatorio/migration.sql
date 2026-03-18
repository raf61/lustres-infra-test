-- DropForeignKey
ALTER TABLE "Ficha" DROP CONSTRAINT "Ficha_pesquisadorId_fkey";

-- AlterTable
ALTER TABLE "Ficha" ALTER COLUMN "pesquisadorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Ficha" ADD CONSTRAINT "Ficha_pesquisadorId_fkey" FOREIGN KEY ("pesquisadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
