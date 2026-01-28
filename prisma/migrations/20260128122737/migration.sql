-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "is_setup_complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meta_data" JSONB;
