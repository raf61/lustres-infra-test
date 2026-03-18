-- CreateEnum
CREATE TYPE "MovimentacaoEstoqueTipo" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" SERIAL NOT NULL,
    "tipo" "MovimentacaoEstoqueTipo" NOT NULL,
    "itemId" BIGINT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "totalAntes" INTEGER NOT NULL,
    "userId" TEXT,
    "observacao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_itemId_idx" ON "MovimentacaoEstoque"("itemId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_userId_idx" ON "MovimentacaoEstoque"("userId");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
