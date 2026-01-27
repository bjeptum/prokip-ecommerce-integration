# WooCommerce Webhook Setup Guide

## Problem Identified
Your WooCommerce store is **not sending webhooks** to the integration server. This is why Prokip inventory is not being reduced when you make sales in WooCommerce.

## Solution: Configure WooCommerce Webhooks

### Step 1: Access WooCommerce Admin
1. Login to your WooCommerce admin panel
2. Go to **WooCommerce → Settings → Advanced → Webhooks**

### Step 2: Create New Webhook
1. Click **Add Webhook** button
2. Configure the webhook with these settings:

#### Basic Settings
- **Name**: `Prokip Inventory Sync`
- **Status**: `Active` ✅

#### Webhook Data
- **Topic**: `Order created` 
- **Delivery URL**: `http://localhost:3000/connections/webhook/woocommerce`
- **Secret**: `prokip_secret` (or any secure string)
- **WooCommerce API version**: `WP REST API Integration v3`

#### Additional Webhooks (Create 3 total)
Create these additional webhooks:

**Webhook 2:**
- **Topic**: `Order updated`
- **Delivery URL**: `http://localhost:3000/connections/webhook/woocommerce`
- **Secret**: `prokip_secret`

**Webhook 3:**
- **Topic**: `Order status changed`  
- **Delivery URL**: `http://localhost:3000/connections/webhook/woocommerce`
- **Secret**: `prokip_secret`

### Step 3: Test Webhook Configuration
1. After creating webhooks, click **Save webhook**
2. WooCommerce will send a test ping to your webhook URL
3. Check that the webhook status shows **"Active"** (not "Paused" or "Disabled")

### Step 4: Verify Webhook Delivery
1. Make a test order in WooCommerce
2. Set order status to **"Completed"** or **"Processing"**
3. Check webhook delivery logs in WooCommerce admin
4. Look for successful deliveries (HTTP 200 response)

### Step 5: Check Server Logs
Run this command to see if webhooks are being received:
```bash
cd backend
node check-webhooks.js
```

You should see webhook events appearing in the database.

## Troubleshooting

### Issue: Webhook Status is "Paused"
**Solution:**
1. Check the webhook delivery logs in WooCommerce
2. Look for error messages (HTTP 4xx, 5xx responses)
3. Ensure your server is running and accessible at the webhook URL

### Issue: Webhook Returns HTTP 401/403
**Solution:**
1. Check if your server is behind a firewall
2. Ensure the webhook URL is correct and accessible
3. Temporarily disable webhook signature verification for testing

### Issue: No Webhook Events in Database
**Solution:**
1. Verify the webhook URL is exactly: `http://localhost:3000/connections/webhook/woocommerce`
2. Check that your server is running on port 3000
3. Test the webhook endpoint manually:
   ```bash
   node test-webhook-endpoint.js
   ```

### Issue: Orders Not Processing
**Solution:**
1. Ensure order status is **"completed"** or **"processing"**
2. Check that products have valid SKUs that match Prokip products
3. Verify Prokip authentication is working

## Production Setup

For production deployment, update the webhook URL:
- **Development**: `http://localhost:3000/connections/webhook/woocommerce`
- **Production**: `https://your-domain.com/connections/webhook/woocommerce`

## Environment Variables

Update your `.env` file:
```env
# Webhook configuration
WEBHOOK_URL=https://your-domain.com/connections/webhook/woocommerce
WOO_WEBHOOK_SECRET=prokip_secret

# Server
PORT=3000
NODE_ENV=production
```

## Verification Steps

After setting up webhooks:

1. ✅ **Test webhook endpoint**: `node test-webhook-endpoint.js`
2. ✅ **Create test order** in WooCommerce with status "completed"
3. ✅ **Check webhook events**: `node check-webhooks.js`
4. ✅ **Verify sales logs**: Look for new entries in sales_logs table
5. ✅ **Check Prokip inventory**: Confirm stock reduction

## Expected Behavior

Once webhooks are properly configured:

1. **Order Created** → Webhook received → Sale recorded in Prokip → Inventory reduced
2. **Order Updated** → Webhook received → Status checked → Inventory adjusted if needed
3. **Order Cancelled** → Webhook received → Inventory restored in Prokip
4. **Order Refunded** → Webhook received → Partial inventory restoration

## Support

If you still have issues:

1. Check WooCommerce webhook delivery logs
2. Verify server is running and accessible
3. Test with the provided test scripts
4. Check database for webhook events and errors

The webhook endpoint is working correctly - the issue is purely WooCommerce configuration!
