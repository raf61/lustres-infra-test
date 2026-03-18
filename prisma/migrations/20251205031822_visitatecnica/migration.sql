-- CreateEnum
CREATE TYPE "VisitaTecnicaStatus" AS ENUM ('AGUARDANDO', 'EM_EXECUCAO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "VisitaTecnica" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "dataMarcada" TIMESTAMP(3) NOT NULL,
    "status" "VisitaTecnicaStatus" NOT NULL,
    "dataRegistroInicio" TIMESTAMP(3),
    "dataRegistroFim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitaTecnica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitaTecnica_pedidoId_idx" ON "VisitaTecnica"("pedidoId");

-- CreateIndex
CREATE INDEX "VisitaTecnica_tecnicoId_idx" ON "VisitaTecnica"("tecnicoId");

-- AddForeignKey
ALTER TABLE "VisitaTecnica" ADD CONSTRAINT "VisitaTecnica_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaTecnica" ADD CONSTRAINT "VisitaTecnica_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
