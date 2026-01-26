-- AlterEnum
ALTER TYPE "BillingCycle" ADD VALUE 'LIFETIME';

-- AlterTable
ALTER TABLE "subscription_prices" ADD COLUMN     "setup_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0;
