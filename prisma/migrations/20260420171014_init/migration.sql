-- CreateTable
CREATE TABLE "Disparo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "atendimentoId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "modelo" TEXT,
    "valor" REAL NOT NULL,
    "dataAtendimento" DATETIME NOT NULL,
    "prestador" TEXT,
    "destinoReal" TEXT NOT NULL,
    "destinoEfetivo" TEXT NOT NULL,
    "testMode" BOOLEAN NOT NULL,
    "templateId" TEXT NOT NULL,
    "atomosMessageId" TEXT,
    "atomosSessionId" TEXT,
    "ultimoStatus" TEXT NOT NULL,
    "failureReason" TEXT,
    "errorMessage" TEXT,
    "statusAtualizadoEm" DATETIME,
    "vPlaca" TEXT NOT NULL,
    "vModelo" TEXT NOT NULL,
    "vValor" TEXT NOT NULL,
    "vData" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatusEvento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disparoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "observadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusEvento_disparoId_fkey" FOREIGN KEY ("disparoId") REFERENCES "Disparo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Disparo_atendimentoId_idx" ON "Disparo"("atendimentoId");

-- CreateIndex
CREATE INDEX "Disparo_ultimoStatus_idx" ON "Disparo"("ultimoStatus");

-- CreateIndex
CREATE INDEX "Disparo_createdAt_idx" ON "Disparo"("createdAt");

-- CreateIndex
CREATE INDEX "StatusEvento_disparoId_observadoEm_idx" ON "StatusEvento"("disparoId", "observadoEm");
