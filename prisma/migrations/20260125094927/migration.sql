/*
  Warnings:

  - You are about to drop the column `desk_permit` on the `admin_users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StallBookingPurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SponsorshipStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PurchaseType" ADD VALUE 'STALL_BOOKING';
ALTER TYPE "PurchaseType" ADD VALUE 'SPONSORSHIP';

-- AlterTable
ALTER TABLE "admin_users" DROP COLUMN "desk_permit";

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "event_type" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "registration_capacity" INTEGER,
    "registration_fee" DECIMAL(10,2),
    "registration_deadline" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "files" JSONB,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stall_booking_setups" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "booking_deadline" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "brochure" JSONB,
    "terms_document" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stall_booking_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stall_categories" (
    "id" SERIAL NOT NULL,
    "stall_booking_setup_id" INTEGER NOT NULL,
    "category_name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "max_seats" INTEGER NOT NULL,
    "booked_seats" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stall_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stall_booking_purchases" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "stall_category_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "invoice_id" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "StallBookingPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "company_name" TEXT,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "special_requests" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stall_booking_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsorship_setups" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "brochure" JSONB,
    "terms_document" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsorship_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsorship_packages" (
    "id" SERIAL NOT NULL,
    "sponsorship_setup_id" INTEGER NOT NULL,
    "package_name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "max_slots" INTEGER NOT NULL,
    "booked_slots" INTEGER NOT NULL DEFAULT 0,
    "benefits" JSONB NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsorship_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsorship_purchases" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "sponsorship_package_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "invoice_id" INTEGER,
    "status" "SponsorshipStatus" NOT NULL DEFAULT 'PENDING',
    "company_name" TEXT NOT NULL,
    "company_website" TEXT,
    "contact_person" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "logo" JSONB,
    "special_requests" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsorship_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_slug_idx" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_start_date_idx" ON "events"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "stall_booking_setups_event_id_key" ON "stall_booking_setups"("event_id");

-- CreateIndex
CREATE INDEX "stall_booking_setups_event_id_idx" ON "stall_booking_setups"("event_id");

-- CreateIndex
CREATE INDEX "stall_categories_stall_booking_setup_id_idx" ON "stall_categories"("stall_booking_setup_id");

-- CreateIndex
CREATE UNIQUE INDEX "stall_booking_purchases_invoice_id_key" ON "stall_booking_purchases"("invoice_id");

-- CreateIndex
CREATE INDEX "stall_booking_purchases_event_id_idx" ON "stall_booking_purchases"("event_id");

-- CreateIndex
CREATE INDEX "stall_booking_purchases_user_id_idx" ON "stall_booking_purchases"("user_id");

-- CreateIndex
CREATE INDEX "stall_booking_purchases_status_idx" ON "stall_booking_purchases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sponsorship_setups_event_id_key" ON "sponsorship_setups"("event_id");

-- CreateIndex
CREATE INDEX "sponsorship_setups_event_id_idx" ON "sponsorship_setups"("event_id");

-- CreateIndex
CREATE INDEX "sponsorship_packages_sponsorship_setup_id_idx" ON "sponsorship_packages"("sponsorship_setup_id");

-- CreateIndex
CREATE UNIQUE INDEX "sponsorship_purchases_invoice_id_key" ON "sponsorship_purchases"("invoice_id");

-- CreateIndex
CREATE INDEX "sponsorship_purchases_event_id_idx" ON "sponsorship_purchases"("event_id");

-- CreateIndex
CREATE INDEX "sponsorship_purchases_user_id_idx" ON "sponsorship_purchases"("user_id");

-- CreateIndex
CREATE INDEX "sponsorship_purchases_status_idx" ON "sponsorship_purchases"("status");

-- AddForeignKey
ALTER TABLE "stall_booking_setups" ADD CONSTRAINT "stall_booking_setups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stall_categories" ADD CONSTRAINT "stall_categories_stall_booking_setup_id_fkey" FOREIGN KEY ("stall_booking_setup_id") REFERENCES "stall_booking_setups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stall_booking_purchases" ADD CONSTRAINT "stall_booking_purchases_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stall_booking_purchases" ADD CONSTRAINT "stall_booking_purchases_stall_category_id_fkey" FOREIGN KEY ("stall_category_id") REFERENCES "stall_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stall_booking_purchases" ADD CONSTRAINT "stall_booking_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stall_booking_purchases" ADD CONSTRAINT "stall_booking_purchases_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_setups" ADD CONSTRAINT "sponsorship_setups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_sponsorship_setup_id_fkey" FOREIGN KEY ("sponsorship_setup_id") REFERENCES "sponsorship_setups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_purchases" ADD CONSTRAINT "sponsorship_purchases_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_purchases" ADD CONSTRAINT "sponsorship_purchases_sponsorship_package_id_fkey" FOREIGN KEY ("sponsorship_package_id") REFERENCES "sponsorship_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_purchases" ADD CONSTRAINT "sponsorship_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_purchases" ADD CONSTRAINT "sponsorship_purchases_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
