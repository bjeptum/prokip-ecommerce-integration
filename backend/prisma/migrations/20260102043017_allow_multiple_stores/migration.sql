-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" SERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "accessToken" TEXT,
    "consumerKey" TEXT,
    "consumerSecret" TEXT,
    "lastSync" TIMESTAMP(3),
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCache" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "InventoryCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLog" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "prokipSellId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProkipConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "token" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "ProkipConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_platform_storeUrl_key" ON "Connection"("platform", "storeUrl");

-- AddForeignKey
ALTER TABLE "InventoryCache" ADD CONSTRAINT "InventoryCache_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLog" ADD CONSTRAINT "SalesLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
