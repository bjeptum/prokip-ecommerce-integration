# WooCommerce Bidirectional Inventory Sync Implementation

## Overview

This document describes the implementation of bidirectional inventory synchronization between WooCommerce and Prokip. The system now automatically reduces inventory in Prokip when sales occur in WooCommerce, completing the bidirectional sync capability.

## What Was Implemented

### 1. Database Schema Update
- Added `prokipSellId` field to the `SalesLog` table to track Prokip transaction IDs
- This enables proper handling of refunds and cancellations

### 2. Enhanced Webhook Processing
- **Improved WooCommerce webhook handler** in `webhookRoutes.js`:
  - Better store URL extraction from multiple sources
  - Enhanced logging for debugging
  - Support for various webhook formats

### 3. Comprehensive Order Processing
- **Updated sync service** in `syncService.js`:
  - Stores Prokip transaction ID when recording sales
  - Handles order creation, updates, cancellations, and refunds
  - Validates payment status before processing
  - Prevents duplicate processing

### 4. Enhanced WooCommerce Service
- **Improved webhook registration** in `wooService.js`:
  - Registers multiple webhook types:
    - `order.created` - New orders
    - `order.updated` - Order modifications
    - `order.status_changed` - Status changes
  - Better error handling for existing webhooks

### 5. Order Status Handling
The system now processes WooCommerce orders with these statuses:
- ✅ `completed` - Reduces inventory in Prokip
- ✅ `processing` - Reduces inventory in Prokip
- ❌ `cancelled` - Restores inventory in Prokip
- ↩️ `refunded` - Restores specific items in Prokip

## How It Works

### WooCommerce → Prokip Flow

1. **Order Created**: WooCommerce sends webhook to `/connections/webhook/woocommerce`
2. **Webhook Processing**: System validates and extracts order data
3. **Payment Verification**: Checks if order is paid/complete
4. **Product Mapping**: Maps WooCommerce SKUs to Prokip product IDs
5. **Inventory Reduction**: Records sale in Prokip via API
6. **Logging**: Stores transaction details in database

### Prokip → WooCommerce Flow (Existing)

1. **Inventory Sync**: Periodic sync from Prokip to WooCommerce
2. **Stock Updates**: Updates product quantities in WooCommerce store
3. **Cache Management**: Maintains local inventory logs

## Webhook Events Supported

| Event | Action | Inventory Impact |
|-------|--------|------------------|
| `order.created` | Process new order | ↓ Reduce in Prokip |
| `order.updated` | Process order changes | ↓ Reduce if paid |
| `order.status_changed` | Process status changes | ↓ Reduce if completed |
| `order.cancelled` | Handle cancellation | ↑ Restore in Prokip |
| `order.refunded` | Process refunds | ↑ Partial restore |

## Testing

### Automated Tests
Run the complete test suite:
```bash
cd backend
node test-woo-complete.js
```

### Manual Testing Steps

1. **Create a test order in WooCommerce**
   - Ensure products have SKUs that match Prokip products
   - Set order status to "completed" or "processing"

2. **Check server logs** for messages like:
   ```
   🔔 WooCommerce webhook received: { topic: 'order.created', storeUrl: 'your-store.com', orderId: '12345' }
   ✓ Sale recorded in Prokip for order 12345 (Prokip ID: 67890)
   ```

3. **Verify database entries**:
   ```sql
   -- Check sales log
   SELECT * FROM sales_logs WHERE order_id = '12345';
   
   -- Check webhook events
   SELECT * FROM webhook_events WHERE payload LIKE '%12345%';
   ```

4. **Verify Prokip inventory**:
   - Check that product stock was reduced
   - Verify the sale transaction was recorded

## Configuration Requirements

### Environment Variables
```env
# Webhook configuration
WEBHOOK_URL=http://localhost:3000/connections/webhook/woocommerce
WOO_WEBHOOK_SECRET=your_secret_key

# Prokip API
PROKIP_API=https://api.prokip.africa
MOCK_PROKIP=false  # Set to true for testing
```

### WooCommerce Setup
1. **Enable REST API** in WooCommerce settings
2. **Create Application Password** or Consumer Key/Secret
3. **Configure webhook URL** in WooCommerce:
   - URL: `http://your-domain.com/connections/webhook/woocommerce`
   - Secret: Same as `WOO_WEBHOOK_SECRET`
   - Events: Order creation, updates, status changes

## Troubleshooting

### Common Issues

1. **Webhook not received**
   - Check WooCommerce webhook configuration
   - Verify firewall allows inbound connections
   - Check webhook delivery logs in WooCommerce

2. **Order not processed**
   - Verify order status is `completed` or `processing`
   - Check products have valid SKUs
   - Review server logs for error messages

3. **Inventory not reduced in Prokip**
   - Verify Prokip authentication
   - Check SKU mapping between systems
   - Review Prokip API connectivity

### Debug Logging
Enable debug logging by setting:
```env
NODE_ENV=development
```

This will provide detailed logs for:
- Webhook receipt and processing
- Order mapping and validation
- Prokip API calls and responses
- Database operations

## Monitoring

### Key Metrics to Monitor
- Webhook processing success rate
- Order processing latency
- Inventory sync accuracy
- Error rates and types

### Database Queries for Monitoring
```sql
-- Recent webhook activity
SELECT * FROM webhook_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Recent sales sync
SELECT * FROM sales_logs 
WHERE synced_at > NOW() - INTERVAL '1 hour'
ORDER BY synced_at DESC;

-- Sync errors
SELECT * FROM sync_errors 
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **HTTPS**: Use HTTPS for webhook URLs in production
3. **Rate Limiting**: Implement rate limiting for webhook endpoints
4. **Input Validation**: All webhook data is validated before processing
5. **Audit Trail**: Complete logging of all sync operations

## Next Steps

1. **Apply database migration**:
   ```sql
   ALTER TABLE sales_logs ADD COLUMN prokip_sell_id VARCHAR(255);
   ```

2. **Test with real WooCommerce store**
3. **Monitor production performance**
4. **Set up alerting for sync failures**

## Support

For issues or questions:
1. Check server logs first
2. Review database tables for error records
3. Verify webhook configuration in WooCommerce
4. Test with the provided test scripts
