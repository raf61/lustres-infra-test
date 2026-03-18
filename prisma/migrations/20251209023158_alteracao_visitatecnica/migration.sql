/*
  Warnings:

  - Added the required column `creatorId` to the `VisitaTecnica` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VisitaTecnica" ADD COLUMN     "creatorId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "VisitaTecnica_creatorId_idx" ON "VisitaTecnica"("creatorId");

-- AddForeignKey
ALTER TABLE "VisitaTecnica" ADD CONSTRAINT "VisitaTecnica_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
