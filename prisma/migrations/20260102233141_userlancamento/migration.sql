-- CreateTable
CREATE TABLE "UserLancamento" (
    "id" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "UserLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLancamento_userId_idx" ON "UserLancamento"("userId");

-- AddForeignKey
ALTER TABLE "UserLancamento" ADD CONSTRAINT "UserLancamento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
