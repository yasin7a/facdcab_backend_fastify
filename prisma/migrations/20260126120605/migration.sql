/*
  Warnings:

  - You are about to drop the column `discountPct` on the `subscription_prices` table. All the data in the column will be lost.
  - You are about to drop the column `promoCode` on the `subscription_prices` table. All the data in the column will be lost.
  - You are about to drop the column `validFrom` on the `subscription_prices` table. All the data in the column will be lost.
  - You are about to drop the column `validUntil` on the `subscription_prices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscription_prices" DROP COLUMN "discountPct",
DROP COLUMN "promoCode",
DROP COLUMN "validFrom",
DROP COLUMN "validUntil",
ADD COLUMN     "discount_pct" INTEGER,
ADD COLUMN     "promo_code" TEXT,
ADD COLUMN     "valid_from" TIMESTAMP(3),
ADD COLUMN     "valid_until" TIMESTAMP(3);
