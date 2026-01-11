-- AlterTable
ALTER TABLE "queue_items" ADD COLUMN     "priority_order" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "queue_items_priority_order_idx" ON "queue_items"("priority_order");
