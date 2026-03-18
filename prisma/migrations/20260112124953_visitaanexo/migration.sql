-- CreateTable
CREATE TABLE "VisitaAnexo" (
    "id" SERIAL NOT NULL,
    "visitaId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "VisitaAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitaAnexo_visitaId_idx" ON "VisitaAnexo"("visitaId");

-- AddForeignKey
ALTER TABLE "VisitaAnexo" ADD CONSTRAINT "VisitaAnexo_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "VisitaTecnica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaAnexo" ADD CONSTRAINT "VisitaAnexo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
