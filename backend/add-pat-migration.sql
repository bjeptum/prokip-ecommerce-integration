-- Create PersonalAccessToken table
CREATE TABLE IF NOT EXISTS "personal_access_tokens" (
    "id" SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL DEFAULT 'pk_',
    "expiresAt" TIMESTAMP NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("connectionId") REFERENCES "prokip_connections"("id") ON DELETE CASCADE
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS "idx_personal_access_tokens_user_id" ON "personal_access_tokens"("userId");
CREATE INDEX IF NOT EXISTS "idx_personal_access_tokens_token" ON "personal_access_tokens"("token");
CREATE INDEX IF NOT EXISTS "idx_personal_access_tokens_active" ON "personal_access_tokens"("isActive", "expiresAt");

-- Add updatedAt trigger for personal_access_tokens
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_personal_access_tokens_updated_at 
    BEFORE UPDATE ON "personal_access_tokens" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
