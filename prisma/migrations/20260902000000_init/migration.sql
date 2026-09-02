-- CreateTable
CREATE TABLE "projects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowAutoRebind" BOOLEAN,
    "autoRebindCooldownMinutes" INTEGER,
    "autoRebindMaxCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "activation_codes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" DATETIME,
    "usedBy" TEXT,
    "lastBoundAt" DATETIME,
    "lastRebindAt" DATETIME,
    "rebindCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "validDays" INTEGER,
    "cardType" TEXT,
    "projectId" INTEGER NOT NULL,
    "licenseMode" TEXT NOT NULL DEFAULT 'TIME',
    "totalCount" INTEGER,
    "remainingCount" INTEGER,
    "consumedCount" INTEGER NOT NULL DEFAULT 0,
    "allowAutoRebind" BOOLEAN,
    "autoRebindCooldownMinutes" INTEGER,
    "autoRebindMaxCount" INTEGER,
    "autoRebindCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "activation_codes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activation_code_binding_histories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "activationCodeId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "operatorType" TEXT NOT NULL,
    "operatorUsername" TEXT,
    "fromMachineId" TEXT,
    "toMachineId" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activation_code_binding_histories_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "activation_codes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "activation_code_binding_histories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_operation_audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminUsername" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "activationCodeId" INTEGER,
    "projectId" INTEGER,
    "targetLabel" TEXT,
    "reason" TEXT,
    "detailJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_operation_audit_logs_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "activation_codes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "admin_operation_audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "license_consumptions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestId" TEXT NOT NULL,
    "activationCodeId" INTEGER NOT NULL,
    "machineId" TEXT NOT NULL,
    "remainingCountAfter" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "license_consumptions_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "activation_codes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "admin_login_rate_limits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "failuresJson" TEXT NOT NULL DEFAULT '[]',
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectKey_key" ON "projects"("projectKey");

-- CreateIndex
CREATE UNIQUE INDEX "activation_codes_code_key" ON "activation_codes"("code");

-- CreateIndex
CREATE INDEX "activation_codes_projectId_idx" ON "activation_codes"("projectId");

-- CreateIndex
CREATE INDEX "activation_codes_projectId_usedBy_isUsed_usedAt_idx" ON "activation_codes"("projectId", "usedBy", "isUsed", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "activation_codes_projectId_usedBy_key" ON "activation_codes"("projectId", "usedBy");

-- CreateIndex
CREATE INDEX "activation_code_binding_histories_activationCodeId_createdAt_idx" ON "activation_code_binding_histories"("activationCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "activation_code_binding_histories_projectId_createdAt_idx" ON "activation_code_binding_histories"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_operation_audit_logs_activationCodeId_createdAt_idx" ON "admin_operation_audit_logs"("activationCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_operation_audit_logs_projectId_createdAt_idx" ON "admin_operation_audit_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_operation_audit_logs_adminUsername_createdAt_idx" ON "admin_operation_audit_logs"("adminUsername", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "license_consumptions_requestId_key" ON "license_consumptions"("requestId");

-- CreateIndex
CREATE INDEX "license_consumptions_activationCodeId_idx" ON "license_consumptions"("activationCodeId");

-- CreateIndex
CREATE INDEX "license_consumptions_activationCodeId_createdAt_idx" ON "license_consumptions"("activationCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "license_consumptions_createdAt_id_idx" ON "license_consumptions"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_login_rate_limits_key_key" ON "admin_login_rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

