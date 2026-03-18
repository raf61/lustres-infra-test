-- AlterTable
ALTER TABLE "chat_inboxes" ADD COLUMN     "messageTemplates" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "messageTemplatesLastUpdated" TIMESTAMPTZ(6);
