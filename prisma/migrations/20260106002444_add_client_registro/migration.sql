-- CreateTable
CREATE TABLE "ClientRegistro" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClientRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientRegistro_clientId_idx" ON "ClientRegistro"("clientId");

-- CreateIndex
CREATE INDEX "ClientRegistro_userId_idx" ON "ClientRegistro"("userId");

-- AddForeignKey
ALTER TABLE "ClientRegistro" ADD CONSTRAINT "ClientRegistro_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRegistro" ADD CONSTRAINT "ClientRegistro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
