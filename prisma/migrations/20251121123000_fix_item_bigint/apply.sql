-- Script para aplicar a mudança de INT para BIGINT na tabela Item
-- Execute este script diretamente no banco de dados se a migration não funcionar

-- 1. Remover a constraint de primary key temporariamente
ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_pkey";

-- 2. Alterar o tipo da coluna id de INT para BIGINT
ALTER TABLE "Item" ALTER COLUMN "id" TYPE BIGINT USING "id"::BIGINT;

-- 3. Recriar a constraint de primary key
ALTER TABLE "Item" ADD CONSTRAINT "Item_pkey" PRIMARY KEY ("id");

