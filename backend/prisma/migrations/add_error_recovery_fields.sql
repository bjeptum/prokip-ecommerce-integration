-- Add error recovery fields to sync_errors table
ALTER TABLE sync_errors 
ADD COLUMN IF NOT EXISTS order_id TEXT,
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recovery_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_recovery_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sync_errors_connection_resolved ON sync_errors(connection_id, resolved);
CREATE INDEX IF NOT EXISTS idx_sync_errors_type_resolved ON sync_errors(error_type, resolved);
CREATE INDEX IF NOT EXISTS idx_sync_errors_severity_resolved ON sync_errors(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_sync_errors_created_at ON sync_errors(created_at);

-- Update existing records to have default values
UPDATE sync_errors 
SET 
  severity = COALESCE(severity, 'medium'),
  auto_resolved = COALESCE(auto_resolved, false),
  recovery_attempts = COALESCE(recovery_attempts, 0),
  updated_at = CURRENT_TIMESTAMP
WHERE severity IS NULL OR auto_resolved IS NULL OR recovery_attempts IS NULL;

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sync_errors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_sync_errors_updated_at
    BEFORE UPDATE ON sync_errors
    FOR EACH ROW
    EXECUTE FUNCTION update_sync_errors_updated_at();
