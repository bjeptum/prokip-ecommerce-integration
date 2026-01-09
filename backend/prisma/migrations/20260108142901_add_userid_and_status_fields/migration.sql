/*
  Warnings:

  - You are about to drop the `Connection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryCache` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProkipConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncError` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "InventoryCache" DROP CONSTRAINT "InventoryCache_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "SalesLog" DROP CONSTRAINT "SalesLog_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "SyncError" DROP CONSTRAINT "SyncError_connectionId_fkey";

-- DropTable
DROP TABLE "Connection";

-- DropTable
DROP TABLE "InventoryCache";

-- DropTable
DROP TABLE "ProkipConfig";

-- DropTable
DROP TABLE "SalesLog";

-- DropTable
DROP TABLE "SyncError";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "storeName" TEXT,
    "accessToken" TEXT,
    "accessTokenSecret" TEXT,
    "consumerKey" TEXT,
    "consumerSecret" TEXT,
    "wooUsername" TEXT,
    "wooAppPassword" TEXT,
    "wooAppName" TEXT,
    "oauthToken" TEXT,
    "oauthSecret" TEXT,
    "lastSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "lastSynced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_logs" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_logs" ADD CONSTRAINT "sales_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
