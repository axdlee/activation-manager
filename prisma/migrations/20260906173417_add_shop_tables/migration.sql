-- CreateTable
CREATE TABLE "shop_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" INTEGER NOT NULL,
    "licenseMode" TEXT NOT NULL DEFAULT 'TIME',
    "cardType" TEXT,
    "validDays" INTEGER,
    "totalCount" INTEGER,
    "priceInCents" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shop_products_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shop_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactWechat" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "paymentNote" TEXT,
    "fulfilledCodeIds" TEXT,
    "remark" TEXT,
    "paidAt" DATETIME,
    "fulfilledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shop_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shop_payment_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "shop_products_projectId_isEnabled_idx" ON "shop_products"("projectId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "shop_orders_orderNo_key" ON "shop_orders"("orderNo");

-- CreateIndex
CREATE INDEX "shop_orders_status_createdAt_idx" ON "shop_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "shop_orders_contactEmail_idx" ON "shop_orders"("contactEmail");

-- CreateIndex
CREATE INDEX "shop_orders_orderNo_idx" ON "shop_orders"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "shop_payment_configs_provider_key" ON "shop_payment_configs"("provider");

