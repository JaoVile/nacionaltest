-- AlterTable
ALTER TABLE "Disparo" ADD COLUMN "concluidoEm" DATETIME;
ALTER TABLE "Disparo" ADD COLUMN "concluidoHttpStatus" INTEGER;
ALTER TABLE "Disparo" ADD COLUMN "concluidoOk" BOOLEAN;
ALTER TABLE "Disparo" ADD COLUMN "concluidoResponse" TEXT;
ALTER TABLE "Disparo" ADD COLUMN "concluirEm" DATETIME;
ALTER TABLE "Disparo" ADD COLUMN "respostaDetectada" BOOLEAN;

-- CreateIndex
CREATE INDEX "Disparo_concluirEm_concluidoEm_idx" ON "Disparo"("concluirEm", "concluidoEm");
