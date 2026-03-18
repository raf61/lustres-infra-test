-- AlterTable
ALTER TABLE "chat_contact_inboxes" ADD COLUMN     "sourceId" TEXT;

-- CreateIndex
CREATE INDEX "chat_contact_inboxes_sourceId_idx" ON "chat_contact_inboxes"("sourceId");
