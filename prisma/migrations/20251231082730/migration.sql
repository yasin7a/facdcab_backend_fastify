/*
  Warnings:

  - You are about to drop the column `is_approved` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `is_rejected` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `is_submitted` on the `applications` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "is_approved",
DROP COLUMN "is_rejected",
DROP COLUMN "is_submitted",
ADD COLUMN     "status" "ApplicationStatus";
