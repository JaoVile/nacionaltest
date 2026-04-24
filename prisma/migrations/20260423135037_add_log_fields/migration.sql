-- AlterTable
ALTER TABLE "Disparo" ADD COLUMN "elapsedMs" INTEGER;
ALTER TABLE "Disparo" ADD COLUMN "httpStatus" INTEGER;
ALTER TABLE "Disparo" ADD COLUMN "rawAtendimento" TEXT;
ALTER TABLE "Disparo" ADD COLUMN "requestPayload" TEXT;
ALTER TABLE "Disparo" ADD COLUMN "responseBody" TEXT;
ALTER TABLE "Disparo" ADD COLUMN "statusCheckBody" TEXT;
