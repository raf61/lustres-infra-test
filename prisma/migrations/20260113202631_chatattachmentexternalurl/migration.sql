/*
  Warnings:

  - You are about to drop the column `url` on the `chat_attachments` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `chat_attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "chat_attachments" DROP COLUMN "url",
ADD COLUMN     "downloadStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "mediaId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL;

-- CreateIndex
CREATE INDEX "chat_attachments_downloadStatus_idx" ON "chat_attachments"("downloadStatus");
