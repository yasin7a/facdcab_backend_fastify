/*
  Warnings:

  - You are about to drop the column `document_types` on the `document_categories` table. All the data in the column will be lost.
  - You are about to drop the `_AdminUserToDocumentCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PersonRole" AS ENUM ('APPLICANT', 'SPOUSE', 'MOTHER', 'FATHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "_AdminUserToDocumentCategory" DROP CONSTRAINT "_AdminUserToDocumentCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "_AdminUserToDocumentCategory" DROP CONSTRAINT "_AdminUserToDocumentCategory_B_fkey";

-- AlterTable
ALTER TABLE "document_categories" DROP COLUMN "document_types",
ADD COLUMN     "adminUserId" INTEGER;

-- DropTable
DROP TABLE "_AdminUserToDocumentCategory";

-- CreateTable
CREATE TABLE "document_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" SERIAL NOT NULL,
    "document_category_id" INTEGER NOT NULL,
    "preferred_date" TIMESTAMP(3),
    "user_id" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_people" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "application_person_id" INTEGER NOT NULL,
    "document_type_id" INTEGER NOT NULL,
    "file" JSONB NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_reviews" (
    "id" SERIAL NOT NULL,
    "review_by_id" INTEGER NOT NULL,
    "document_id" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DocumentCategoryToDocumentType" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DocumentCategoryToDocumentType_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_application_person_id_document_type_id_key" ON "Document"("application_person_id", "document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_reviews_document_id_key" ON "document_reviews"("document_id");

-- CreateIndex
CREATE INDEX "_DocumentCategoryToDocumentType_B_index" ON "_DocumentCategoryToDocumentType"("B");

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_document_category_id_fkey" FOREIGN KEY ("document_category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_people" ADD CONSTRAINT "application_people_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_application_person_id_fkey" FOREIGN KEY ("application_person_id") REFERENCES "application_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_review_by_id_fkey" FOREIGN KEY ("review_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentCategoryToDocumentType" ADD CONSTRAINT "_DocumentCategoryToDocumentType_A_fkey" FOREIGN KEY ("A") REFERENCES "document_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentCategoryToDocumentType" ADD CONSTRAINT "_DocumentCategoryToDocumentType_B_fkey" FOREIGN KEY ("B") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
