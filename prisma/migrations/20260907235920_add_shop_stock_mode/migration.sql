-- CreateTable
CREATE TABLE "shop_product_code_stocks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "activationCodeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "soldOrderId" INTEGER,
    "soldAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_product_code_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_shop_products" (
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
    "stockMode" TEXT NOT NULL DEFAULT 'DYNAMIC',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shop_products_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_shop_products" ("cardType", "createdAt", "description", "id", "isEnabled", "licenseMode", "name", "priceInCents", "projectId", "sortOrder", "totalCount", "updatedAt", "validDays") SELECT "cardType", "createdAt", "description", "id", "isEnabled", "licenseMode", "name", "priceInCents", "projectId", "sortOrder", "totalCount", "updatedAt", "validDays" FROM "shop_products";
DROP TABLE "shop_products";
ALTER TABLE "new_shop_products" RENAME TO "shop_products";
CREATE INDEX "shop_products_projectId_isEnabled_idx" ON "shop_products"("projectId", "isEnabled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "shop_product_code_stocks_activationCodeId_key" ON "shop_product_code_stocks"("activationCodeId");

-- CreateIndex
CREATE INDEX "shop_product_code_stocks_productId_status_idx" ON "shop_product_code_stocks"("productId", "status");

