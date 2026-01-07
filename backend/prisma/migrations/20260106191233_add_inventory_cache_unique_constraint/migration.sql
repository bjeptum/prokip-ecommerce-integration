/*
  Warnings:

  - A unique constraint covering the columns `[connectionId,sku]` on the table `InventoryCache` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "InventoryCache_connectionId_sku_key" ON "InventoryCache"("connectionId", "sku");
