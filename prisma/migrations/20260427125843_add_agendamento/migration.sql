-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "modo" TEXT NOT NULL DEFAULT 'massa',
    "diasSemana" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "hora" INTEGER NOT NULL DEFAULT 9,
    "minuto" INTEGER NOT NULL DEFAULT 0,
    "placas" TEXT,
    "ultimaExec" DATETIME,
    "ultimoTotal" INTEGER,
    "ultimoOk" INTEGER,
    "ultimoFalha" INTEGER,
    "ultimoErro" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
