/*
  Warnings:

  - You are about to drop the `ProventoCached` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `isRedeemed` on the `FixedIncomeAsset` table. All the data in the column will be lost.
  - Added the required column `subtype` to the `FixedIncomeAsset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FixedIncomeAsset` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProventoCached_ticker_exDate_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProventoCached";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "InvImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'b3_movimentacao',
    "rowCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProventoReceived" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "exDate" DATETIME,
    "quantity" REAL NOT NULL,
    "unitValue" REAL NOT NULL,
    "totalValue" REAL NOT NULL,
    "broker" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProventoReceived_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "close" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'brapi',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuoteCache" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL,
    "change1d" REAL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FixedIncomeMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceAfter" REAL,
    "description" TEXT,
    "linkedTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixedIncomeMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedIncomeAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FixedIncomeAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "indexer" TEXT NOT NULL,
    "rate" REAL,
    "investedValue" REAL NOT NULL DEFAULT 0,
    "currentValue" REAL NOT NULL DEFAULT 0,
    "purchaseDate" DATETIME NOT NULL,
    "maturityDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "linkedAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FixedIncomeAsset_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FixedIncomeAsset" ("createdAt", "currentValue", "id", "indexer", "investedValue", "issuer", "maturityDate", "name", "profileId", "purchaseDate", "rate") SELECT "createdAt", "currentValue", "id", "indexer", "investedValue", "issuer", "maturityDate", "name", "profileId", "purchaseDate", "rate" FROM "FixedIncomeAsset";
DROP TABLE "FixedIncomeAsset";
ALTER TABLE "new_FixedIncomeAsset" RENAME TO "FixedIncomeAsset";
CREATE TABLE "new_InvestmentOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT,
    "assetClass" TEXT NOT NULL,
    "broker" TEXT,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL,
    "totalValue" REAL,
    "fees" REAL NOT NULL DEFAULT 0,
    "affectsPosition" BOOLEAN NOT NULL DEFAULT true,
    "splitRatio" REAL,
    "importBatchId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentOperation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvestmentOperation_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "InvImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvestmentOperation" ("assetClass", "broker", "createdAt", "date", "fees", "id", "notes", "profileId", "quantity", "ticker", "type", "unitPrice") SELECT "assetClass", "broker", "createdAt", "date", "fees", "id", "notes", "profileId", "quantity", "ticker", "type", "unitPrice" FROM "InvestmentOperation";
DROP TABLE "InvestmentOperation";
ALTER TABLE "new_InvestmentOperation" RENAME TO "InvestmentOperation";
CREATE INDEX "InvestmentOperation_profileId_ticker_idx" ON "InvestmentOperation"("profileId", "ticker");
CREATE INDEX "InvestmentOperation_profileId_date_idx" ON "InvestmentOperation"("profileId", "date" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProventoReceived_profileId_date_idx" ON "ProventoReceived"("profileId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProventoReceived_ticker_date_type_broker_key" ON "ProventoReceived"("ticker", "date", "type", "broker");

-- CreateIndex
CREATE INDEX "PriceHistory_ticker_date_idx" ON "PriceHistory"("ticker", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_ticker_date_key" ON "PriceHistory"("ticker", "date");
