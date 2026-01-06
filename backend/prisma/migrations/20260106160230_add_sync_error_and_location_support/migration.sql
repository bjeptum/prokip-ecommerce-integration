-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "defaultLocationId" TEXT;

-- CreateTable
CREATE TABLE "SyncError" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "orderId" TEXT,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SyncError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncError_connectionId_idx" ON "SyncError"("connectionId");

-- CreateIndex
CREATE INDEX "SyncError_resolved_idx" ON "SyncError"("resolved");

-- CreateIndex
CREATE INDEX "SyncError_createdAt_idx" ON "SyncError"("createdAt");

-- AddForeignKey
ALTER TABLE "SyncError" ADD CONSTRAINT "SyncError_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
