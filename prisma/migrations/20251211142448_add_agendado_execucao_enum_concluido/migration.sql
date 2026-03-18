/*
  Warnings:

  - The values [AGENDADO_OU_EXECUCAO] on the enum `PedidoStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PedidoStatus_new" AS ENUM ('AGUARDANDO', 'AGENDADO', 'EXECUCAO', 'CONCLUIDO', 'CANCELADO', 'SAC', 'AGUARDANDO_APROVACAO_SUPERVISAO', 'AGUARDANDO_APROVACAO_FINAL', 'ANALISE_CANCELAMENTO', 'ANALISE_CANCELAMENTO_SUPERVISAO');
ALTER TABLE "public"."Pedido" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Pedido" ALTER COLUMN "status" TYPE "PedidoStatus_new" USING ("status"::text::"PedidoStatus_new");
ALTER TYPE "PedidoStatus" RENAME TO "PedidoStatus_old";
ALTER TYPE "PedidoStatus_new" RENAME TO "PedidoStatus";
DROP TYPE "public"."PedidoStatus_old";
ALTER TABLE "Pedido" ALTER COLUMN "status" SET DEFAULT 'AGUARDANDO';
COMMIT;
