-- DropForeignKey
ALTER TABLE "document_reviews" DROP CONSTRAINT "document_reviews_document_id_fkey";

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
