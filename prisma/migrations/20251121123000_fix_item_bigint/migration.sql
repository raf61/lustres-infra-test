-- AlterTable
-- Alterando o tipo de id de INT para BIGINT
ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_pkey";
ALTER TABLE "Item" ALTER COLUMN "id" SET DATA TYPE BIGINT;
ALTER TABLE "Item" ADD CONSTRAINT "Item_pkey" PRIMARY KEY ("id");

