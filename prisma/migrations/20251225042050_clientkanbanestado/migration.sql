-- CreateTable
CREATE TABLE "ClientKanbanEstado" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "code" INTEGER NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientKanbanEstado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientKanbanEstado_clientId_key" ON "ClientKanbanEstado"("clientId");

-- CreateIndex
CREATE INDEX "ClientKanbanEstado_code_idx" ON "ClientKanbanEstado"("code");

-- CreateIndex
CREATE INDEX "ClientKanbanEstado_position_idx" ON "ClientKanbanEstado"("position");

-- AddForeignKey
ALTER TABLE "ClientKanbanEstado" ADD CONSTRAINT "ClientKanbanEstado_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
