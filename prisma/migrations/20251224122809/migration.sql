-- CreateTable
CREATE TABLE "document_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "document_types" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AdminUserToDocumentCategory" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AdminUserToDocumentCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_name_key" ON "document_categories"("name");

-- CreateIndex
CREATE INDEX "_AdminUserToDocumentCategory_B_index" ON "_AdminUserToDocumentCategory"("B");

-- AddForeignKey
ALTER TABLE "_AdminUserToDocumentCategory" ADD CONSTRAINT "_AdminUserToDocumentCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdminUserToDocumentCategory" ADD CONSTRAINT "_AdminUserToDocumentCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "document_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
