/*
  Warnings:

  - The values [login,register,forgot] on the enum `OtpType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OtpType_new" AS ENUM ('LOGIN', 'REGISTER', 'FORGOT');
ALTER TABLE "otp_verifications" ALTER COLUMN "type" TYPE "OtpType_new" USING ("type"::text::"OtpType_new");
ALTER TYPE "OtpType" RENAME TO "OtpType_old";
ALTER TYPE "OtpType_new" RENAME TO "OtpType";
DROP TYPE "public"."OtpType_old";
COMMIT;
