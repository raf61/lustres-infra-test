-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "externalError" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';
