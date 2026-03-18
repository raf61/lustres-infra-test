/*
  Warnings:

  - You are about to drop the column `lastIncomingMessageAt` on the `chat_conversations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "chat_conversations" DROP COLUMN "lastIncomingMessageAt";
