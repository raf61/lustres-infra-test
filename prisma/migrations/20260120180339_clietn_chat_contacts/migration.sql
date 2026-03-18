-- CreateTable
CREATE TABLE "client_chat_contacts" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_chat_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_chat_contacts_clientId_idx" ON "client_chat_contacts"("clientId");

-- CreateIndex
CREATE INDEX "client_chat_contacts_contactId_idx" ON "client_chat_contacts"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "client_chat_contacts_clientId_contactId_key" ON "client_chat_contacts"("clientId", "contactId");

-- AddForeignKey
ALTER TABLE "client_chat_contacts" ADD CONSTRAINT "client_chat_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_chat_contacts" ADD CONSTRAINT "client_chat_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "chat_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
