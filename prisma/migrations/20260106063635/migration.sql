/*
  Warnings:

  - You are about to drop the column `appointment_id` on the `queue_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[application_id]` on the table `queue_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `application_id` to the `queue_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_appointment_id_fkey";

-- DropIndex
DROP INDEX "queue_items_appointment_id_key";

-- AlterTable
ALTER TABLE "queue_items" DROP COLUMN "appointment_id",
ADD COLUMN     "application_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "queue_items_application_id_key" ON "queue_items"("application_id");

-- AddForeignKey
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
