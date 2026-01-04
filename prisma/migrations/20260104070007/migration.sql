/*
  Warnings:

  - You are about to drop the column `preferred_date` on the `applications` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DeskStatus" AS ENUM ('AVAILABLE', 'BUSY', 'BREAK');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'RUNNING', 'DONE', 'MISSED', 'RECALLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'BOOKED';

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "preferred_date",
ADD COLUMN     "appointment_date" TIMESTAMP(3),
ADD COLUMN     "time_slot" TEXT;

-- CreateTable
CREATE TABLE "Desk" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DeskStatus" NOT NULL DEFAULT 'AVAILABLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Desk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeHours" (
    "id" SERIAL NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "appointment_duration" INTEGER NOT NULL,
    "weekend_days" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" SERIAL NOT NULL,
    "appointment_id" INTEGER NOT NULL,
    "serial_number" INTEGER NOT NULL,
    "desk_id" INTEGER,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "missed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueueItem_appointment_id_key" ON "QueueItem"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "QueueItem_serial_number_key" ON "QueueItem"("serial_number");

-- CreateIndex
CREATE INDEX "QueueItem_status_idx" ON "QueueItem"("status");

-- CreateIndex
CREATE INDEX "QueueItem_serial_number_idx" ON "QueueItem"("serial_number");

-- CreateIndex
CREATE INDEX "applications_appointment_date_time_slot_idx" ON "applications"("appointment_date", "time_slot");

-- CreateIndex
CREATE INDEX "applications_user_id_idx" ON "applications"("user_id");

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_desk_id_fkey" FOREIGN KEY ("desk_id") REFERENCES "Desk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
