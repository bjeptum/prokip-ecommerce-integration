-- Database Migration for Per-User WooCommerce → Prokip Integration
-- Run this migration to create the necessary tables for per-user authentication

-- Create ProkipConnection table for storing user tokens
CREATE TABLE "ProkipConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prokipUserId" TEXT NOT NULL,
    "prokipEmail" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "connectionName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProkipConnection_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ProkipConnection
CREATE INDEX "ProkipConnection_userId_idx" ON "ProkipConnection"("userId");
CREATE INDEX "ProkipConnection_prokipUserId_idx" ON "ProkipConnection"("prokipUserId");
CREATE INDEX "ProkipConnection_isActive_idx" ON "ProkipConnection"("isActive");
CREATE INDEX "ProkipConnection_tokenExpiresAt_idx" ON "ProkipConnection"("tokenExpiresAt");

-- Create unique constraint for one active connection per user
CREATE UNIQUE INDEX "ProkipConnection_userId_isActive_key" ON "ProkipConnection"("userId", "isActive");

-- Create StockTransaction table for tracking stock deductions
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "wooOrderId" TEXT NOT NULL,
    "wooOrderNumber" TEXT,
    "transactionId" TEXT,
    "receiptNumber" TEXT,
    "customerInfo" JSONB,
    "products" JSONB NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "stockBefore" JSONB,
    "stockAfter" JSONB,
    "itemsDeducted" JSONB,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockTransaction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProkipConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for StockTransaction
CREATE INDEX "StockTransaction_userId_idx" ON "StockTransaction"("userId");
CREATE INDEX "StockTransaction_connectionId_idx" ON "StockTransaction"("connectionId");
CREATE INDEX "StockTransaction_wooOrderId_idx" ON "StockTransaction"("wooOrderId");
CREATE INDEX "StockTransaction_status_idx" ON "StockTransaction"("status");
CREATE INDEX "StockTransaction_createdAt_idx" ON "StockTransaction"("createdAt");

-- Create unique constraint to prevent duplicate orders per connection
CREATE UNIQUE INDEX "StockTransaction_wooOrderId_connectionId_key" ON "StockTransaction"("wooOrderId", "connectionId");

-- Create WebhookLog table for debugging
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "wooOrderId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN,
    "errorMessage" TEXT,
    "processingTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebhookLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProkipConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for WebhookLog
CREATE INDEX "WebhookLog_userId_idx" ON "WebhookLog"("userId");
CREATE INDEX "WebhookLog_connectionId_idx" ON "WebhookLog"("connectionId");
CREATE INDEX "WebhookLog_webhookType_idx" ON "WebhookLog"("webhookType");
CREATE INDEX "WebhookLog_wooOrderId_idx" ON "WebhookLog"("wooOrderId");
CREATE INDEX "WebhookLog_processed_idx" ON "WebhookLog"("processed");
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");

-- Create UserIntegrationSettings table
CREATE TABLE "UserIntegrationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stockCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT,
    "defaultLocationId" TEXT,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "enableNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmail" TEXT,
    "skuMapping" JSONB,
    "autoCreateCustomers" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelaySeconds" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntegrationSettings_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for UserIntegrationSettings
CREATE UNIQUE INDEX "UserIntegrationSettings_userId_key" ON "UserIntegrationSettings"("userId");

-- Create FailedSync table for manual review
CREATE TABLE "FailedSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "wooOrderId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailedSync_pkey" PRIMARY KEY ("id")
);

-- Create indexes for FailedSync
CREATE INDEX "FailedSync_userId_idx" ON "FailedSync"("userId");
CREATE INDEX "FailedSync_connectionId_idx" ON "FailedSync"("connectionId");
CREATE INDEX "FailedSync_wooOrderId_idx" ON "FailedSync"("wooOrderId");
CREATE INDEX "FailedSync_errorType_idx" ON "FailedSync"("errorType");
CREATE INDEX "FailedSync_resolved_idx" ON "FailedSync"("resolved");
CREATE INDEX "FailedSync_nextRetryAt_idx" ON "FailedSync"("nextRetryAt");

-- Create ApiUsage table for monitoring
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ApiUsage
CREATE INDEX "ApiUsage_userId_idx" ON "ApiUsage"("userId");
CREATE INDEX "ApiUsage_connectionId_idx" ON "ApiUsage"("connectionId");
CREATE INDEX "ApiUsage_endpoint_idx" ON "ApiUsage"("endpoint");
CREATE INDEX "ApiUsage_statusCode_idx" ON "ApiUsage"("statusCode");
CREATE INDEX "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");

-- Add encryption secret to environment (you should set this in your .env file)
-- ENCRYPTION_SECRET=your-super-secure-encryption-key-here

-- Create trigger for updating updatedAt timestamp (PostgreSQL example)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updatedAt
CREATE TRIGGER update_ProkipConnection_updated_at BEFORE UPDATE ON "ProkipConnection" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_StockTransaction_updated_at BEFORE UPDATE ON "StockTransaction" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_UserIntegrationSettings_updated_at BEFORE UPDATE ON "UserIntegrationSettings" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_FailedSync_updated_at BEFORE UPDATE ON "FailedSync" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
