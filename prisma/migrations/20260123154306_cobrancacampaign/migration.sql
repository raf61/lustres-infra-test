-- CreateTable
CREATE TABLE "CobrancaCampanha" (
    "id" SERIAL NOT NULL,
    "nome" TEXT,
    "inboxId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL,
    "templateComponents" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CobrancaCampanha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobrancaCampanhaEnvio" (
    "id" SERIAL NOT NULL,
    "campanhaId" INTEGER NOT NULL,
    "debitoId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CobrancaCampanhaEnvio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CobrancaCampanha_createdById_idx" ON "CobrancaCampanha"("createdById");

-- CreateIndex
CREATE INDEX "CobrancaCampanha_createdAt_idx" ON "CobrancaCampanha"("createdAt");

-- CreateIndex
CREATE INDEX "CobrancaCampanhaEnvio_campanhaId_idx" ON "CobrancaCampanhaEnvio"("campanhaId");

-- CreateIndex
CREATE INDEX "CobrancaCampanhaEnvio_debitoId_idx" ON "CobrancaCampanhaEnvio"("debitoId");

-- CreateIndex
CREATE INDEX "CobrancaCampanhaEnvio_clienteId_idx" ON "CobrancaCampanhaEnvio"("clienteId");

-- CreateIndex
CREATE INDEX "CobrancaCampanhaEnvio_createdAt_idx" ON "CobrancaCampanhaEnvio"("createdAt");

-- AddForeignKey
ALTER TABLE "CobrancaCampanha" ADD CONSTRAINT "CobrancaCampanha_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobrancaCampanhaEnvio" ADD CONSTRAINT "CobrancaCampanhaEnvio_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "CobrancaCampanha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobrancaCampanhaEnvio" ADD CONSTRAINT "CobrancaCampanhaEnvio_debitoId_fkey" FOREIGN KEY ("debitoId") REFERENCES "Debito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobrancaCampanhaEnvio" ADD CONSTRAINT "CobrancaCampanhaEnvio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
