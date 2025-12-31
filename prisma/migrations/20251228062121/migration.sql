/*
  Warnings:

  - You are about to drop the column `adminUserId` on the `document_categories` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "document_categories" DROP CONSTRAINT "document_categories_adminUserId_fkey";

-- AlterTable
ALTER TABLE "document_categories" DROP COLUMN "adminUserId",
ADD COLUMN     "created_by_id" INTEGER,
ADD COLUMN     "updated_by_id" INTEGER;

-- AlterTable
ALTER TABLE "document_types" ADD COLUMN     "created_by_id" INTEGER,
ADD COLUMN     "updated_by_id" INTEGER;

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
