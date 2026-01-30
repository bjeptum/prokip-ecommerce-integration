-- Add stock deduction tracking fields to sales_logs table
ALTER TABLE sales_logs 
ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stock_deduction_date TIMESTAMP NULL;
