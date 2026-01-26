/*
  Warnings:

  - You are about to drop the column `files` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `events` table. All the data in the column will be lost.
  - Added the required column `name` to the `events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "files",
DROP COLUMN "title",
ADD COLUMN     "banner" JSONB,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "old_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "is_active" SET DEFAULT false;
