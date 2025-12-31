-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_application_person_id_fkey";

-- DropForeignKey
ALTER TABLE "application_people" DROP CONSTRAINT "application_people_application_id_fkey";

-- AlterTable
ALTER TABLE "application_people" ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone_number" TEXT;

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "is_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_rejected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_submitted" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "application_people" ADD CONSTRAINT "application_people_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_application_person_id_fkey" FOREIGN KEY ("application_person_id") REFERENCES "application_people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
