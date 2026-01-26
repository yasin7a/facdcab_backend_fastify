/*
  Warnings:

  - You are about to drop the column `logo` on the `sponsorship_purchases` table. All the data in the column will be lost.
  - You are about to drop the column `terms_document` on the `sponsorship_setups` table. All the data in the column will be lost.
  - You are about to drop the column `terms_document` on the `stall_booking_setups` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `stall_categories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sponsorship_packages" ADD COLUMN     "is_premium" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "benefits" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sponsorship_purchases" DROP COLUMN "logo";

-- AlterTable
ALTER TABLE "sponsorship_setups" DROP COLUMN "terms_document";

-- AlterTable
ALTER TABLE "stall_booking_setups" DROP COLUMN "terms_document",
ALTER COLUMN "booking_deadline" DROP NOT NULL;

-- AlterTable
ALTER TABLE "stall_categories" DROP COLUMN "description",
ADD COLUMN     "features" JSONB,
ADD COLUMN     "is_premium" BOOLEAN NOT NULL DEFAULT false;
