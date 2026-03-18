-- Add enum for pedido tipo especial
CREATE TYPE "PedidoTipoEspecial" AS ENUM ('OS');

-- Add column to Pedido
ALTER TABLE "Pedido" ADD COLUMN "tipoEspecial" "PedidoTipoEspecial";

-- Add new DocumentoOperacionalTipo value
ALTER TYPE "DocumentoOperacionalTipo" ADD VALUE 'ORDEM_SERVICO';

