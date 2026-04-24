-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "payloadHash" TEXT,
    "metadata" TEXT,
    "statusCode" INTEGER,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AuditLog_userEmail_createdAt_idx" ON "AuditLog"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
