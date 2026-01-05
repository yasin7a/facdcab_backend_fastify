-- CreateTable
CREATE TABLE "_desk_document_categories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_desk_document_categories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_desk_document_categories_B_index" ON "_desk_document_categories"("B");

-- AddForeignKey
ALTER TABLE "_desk_document_categories" ADD CONSTRAINT "_desk_document_categories_A_fkey" FOREIGN KEY ("A") REFERENCES "desks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_desk_document_categories" ADD CONSTRAINT "_desk_document_categories_B_fkey" FOREIGN KEY ("B") REFERENCES "document_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
