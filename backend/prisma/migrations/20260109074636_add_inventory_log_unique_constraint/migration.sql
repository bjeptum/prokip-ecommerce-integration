/*
  Warnings:

  - A unique constraint covering the columns `[connectionId,sku]` on the table `inventory_logs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "inventory_logs_connectionId_sku_key" ON "inventory_logs"("connectionId", "sku");
