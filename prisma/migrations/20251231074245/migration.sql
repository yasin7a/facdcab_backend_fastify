-- AlterTable
ALTER TABLE "application_people" ADD COLUMN     "passport_number" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passport_number" TEXT,
ADD COLUMN     "phone_number" TEXT;
