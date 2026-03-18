-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "waitingSince" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "chat_conversations_assigneeId_idx" ON "chat_conversations"("assigneeId");

-- CreateIndex
CREATE INDEX "chat_conversations_status_idx" ON "chat_conversations"("status");

-- CreateIndex
CREATE INDEX "chat_conversations_waitingSince_idx" ON "chat_conversations"("waitingSince");

-- CreateIndex
CREATE INDEX "chat_conversations_lastActivityAt_idx" ON "chat_conversations"("lastActivityAt");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
