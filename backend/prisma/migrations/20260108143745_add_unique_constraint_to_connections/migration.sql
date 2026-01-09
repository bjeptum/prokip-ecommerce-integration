/*
  Warnings:

  - A unique constraint covering the columns `[userId,platform,storeUrl]` on the table `connections` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "connections_userId_platform_storeUrl_key" ON "connections"("userId", "platform", "storeUrl");
