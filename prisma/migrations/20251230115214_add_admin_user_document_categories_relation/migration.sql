-- CreateTable
CREATE TABLE "_admin_user_document_categories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_admin_user_document_categories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_admin_user_document_categories_B_index" ON "_admin_user_document_categories"("B");

-- AddForeignKey
ALTER TABLE "_admin_user_document_categories" ADD CONSTRAINT "_admin_user_document_categories_A_fkey" FOREIGN KEY ("A") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_admin_user_document_categories" ADD CONSTRAINT "_admin_user_document_categories_B_fkey" FOREIGN KEY ("B") REFERENCES "document_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
