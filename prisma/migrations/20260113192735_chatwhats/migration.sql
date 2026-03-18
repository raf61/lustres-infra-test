-- CreateTable
CREATE TABLE "chat_inboxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'whatsapp_cloud',
    "phoneNumberId" TEXT,
    "displayPhoneNumber" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "waId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_contact_inboxes" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_contact_inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "messageType" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "timestamp" TIMESTAMPTZ(6),
    "contentAttributes" JSONB NOT NULL DEFAULT '{}',
    "additionalAttributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "url" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "coordinatesLat" DOUBLE PRECISION,
    "coordinatesLong" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_inboxes_phoneNumberId_key" ON "chat_inboxes"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_contacts_waId_key" ON "chat_contacts"("waId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_contact_inboxes_contactId_inboxId_key" ON "chat_contact_inboxes"("contactId", "inboxId");

-- CreateIndex
CREATE INDEX "chat_conversations_inboxId_idx" ON "chat_conversations"("inboxId");

-- CreateIndex
CREATE INDEX "chat_conversations_contactId_idx" ON "chat_conversations"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_providerMessageId_key" ON "chat_messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- CreateIndex
CREATE INDEX "chat_messages_providerMessageId_idx" ON "chat_messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "chat_attachments_messageId_idx" ON "chat_attachments"("messageId");

-- AddForeignKey
ALTER TABLE "chat_contact_inboxes" ADD CONSTRAINT "chat_contact_inboxes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "chat_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_contact_inboxes" ADD CONSTRAINT "chat_contact_inboxes_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "chat_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "chat_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "chat_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
