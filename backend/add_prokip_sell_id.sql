-- Add prokipSellId column to sales_logs table
ALTER TABLE sales_logs 
ADD COLUMN prokip_sell_id VARCHAR(255);
