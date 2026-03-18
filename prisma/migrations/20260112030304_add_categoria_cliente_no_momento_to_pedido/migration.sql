-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "categoriaClienteNoMomento" "ClientCategoria";

-- CreateIndex
CREATE INDEX "Pedido_categoriaClienteNoMomento_idx" ON "Pedido"("categoriaClienteNoMomento");
