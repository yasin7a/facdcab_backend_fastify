-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
