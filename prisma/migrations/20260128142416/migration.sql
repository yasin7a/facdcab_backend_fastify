/*
  Warnings:

  - You are about to drop the column `organization_id` on the `organization_recommendations` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `organization_recommendations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[requesting_organization_id,target_organization_id]` on the table `organization_recommendations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `requesting_organization_id` to the `organization_recommendations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target_organization_id` to the `organization_recommendations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "organization_recommendations" DROP CONSTRAINT "organization_recommendations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_recommendations" DROP CONSTRAINT "organization_recommendations_user_id_fkey";

-- DropIndex
DROP INDEX "organization_recommendations_organization_id_user_id_key";

-- AlterTable
ALTER TABLE "organization_recommendations" DROP COLUMN "organization_id",
DROP COLUMN "user_id",
ADD COLUMN     "requesting_organization_id" INTEGER NOT NULL,
ADD COLUMN     "target_organization_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "organization_recommendations_requesting_organization_id_tar_key" ON "organization_recommendations"("requesting_organization_id", "target_organization_id");

-- AddForeignKey
ALTER TABLE "organization_recommendations" ADD CONSTRAINT "organization_recommendations_requesting_organization_id_fkey" FOREIGN KEY ("requesting_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_recommendations" ADD CONSTRAINT "organization_recommendations_target_organization_id_fkey" FOREIGN KEY ("target_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
