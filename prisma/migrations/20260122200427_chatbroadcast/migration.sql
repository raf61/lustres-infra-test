-- CreateEnum
CREATE TYPE "ChatBroadcastStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ChatBroadcastRecipientStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "chat_broadcasts" (
    "id" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ChatBroadcastStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "contactId" TEXT,
    "contactInboxId" TEXT,
    "messageId" TEXT,
    "status" "ChatBroadcastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_broadcasts_inboxId_idx" ON "chat_broadcasts"("inboxId");

-- CreateIndex
CREATE INDEX "chat_broadcasts_createdById_idx" ON "chat_broadcasts"("createdById");

-- CreateIndex
CREATE INDEX "chat_broadcasts_status_idx" ON "chat_broadcasts"("status");

-- CreateIndex
CREATE INDEX "chat_broadcast_recipients_broadcastId_idx" ON "chat_broadcast_recipients"("broadcastId");

-- CreateIndex
CREATE INDEX "chat_broadcast_recipients_contactId_idx" ON "chat_broadcast_recipients"("contactId");

-- CreateIndex
CREATE INDEX "chat_broadcast_recipients_contactInboxId_idx" ON "chat_broadcast_recipients"("contactInboxId");

-- CreateIndex
CREATE INDEX "chat_broadcast_recipients_messageId_idx" ON "chat_broadcast_recipients"("messageId");

-- CreateIndex
CREATE INDEX "chat_broadcast_recipients_status_idx" ON "chat_broadcast_recipients"("status");

-- AddForeignKey
ALTER TABLE "chat_broadcasts" ADD CONSTRAINT "chat_broadcasts_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "chat_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_broadcasts" ADD CONSTRAINT "chat_broadcasts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_broadcast_recipients" ADD CONSTRAINT "chat_broadcast_recipients_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "chat_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_broadcast_recipients" ADD CONSTRAINT "chat_broadcast_recipients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "chat_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_broadcast_recipients" ADD CONSTRAINT "chat_broadcast_recipients_contactInboxId_fkey" FOREIGN KEY ("contactInboxId") REFERENCES "chat_contact_inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_broadcast_recipients" ADD CONSTRAINT "chat_broadcast_recipients_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
