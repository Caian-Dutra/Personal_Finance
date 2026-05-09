-- AlterTable
ALTER TABLE "PatrimonyItem" ADD COLUMN "fipeBrandCode" TEXT;
ALTER TABLE "PatrimonyItem" ADD COLUMN "fipeModelCode" TEXT;
ALTER TABLE "PatrimonyItem" ADD COLUMN "fipeVehicleType" TEXT;
ALTER TABLE "PatrimonyItem" ADD COLUMN "fipeYearCode" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date" DESC);

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_deletedAt_idx" ON "Transaction"("deletedAt");
