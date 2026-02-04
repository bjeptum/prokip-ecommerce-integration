# WooCommerce Webhook Setup Guide
## For Your Ngrok URL: https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce

## ✅ Your System Status

Your Prokip E-commerce Integration is **perfectly configured** for bidirectional sync:

### ✅ What's Already Working:
- ✅ Backend server running on localhost:3000
- ✅ Database connected and operational
- ✅ Webhook routes properly configured
- ✅ Prokip API integration implemented
- ✅ Stock deduction logic in place
- ✅ Order processing pipeline ready

### 🔗 Webhook Routes Configured:
- `/webhooks/woocommerce` - Primary webhook endpoint
- `/connections/webhook/woocommerce` - Ngrok compatible endpoint
- Both routes process webhooks identically

## 🛠️ WooCommerce Webhook Configuration

### 1. In Your WooCommerce Admin:

1. **Go to WooCommerce → Settings → Advanced → Webhooks**
2. **Click "Add Webhook"**
3. **Configure as follows:**

```
Name: Prokip Integration
Status: Active
Topic: Order created
Delivery URL: https://nonluminous-flawed-lonny.ngrok-free.dev/connections/webhook/woocommerce
Secret: [Generate a random secret - save it!]
```

4. **Add additional webhooks:**
   - **Order updated** (for refunds/cancellations)
   - **Product updated** (for inventory changes)

### 2. Webhook Topics to Create:

| Webhook | Topic | Purpose |
|---------|--------|---------|
| Prokip Orders | `order.created` | New order processing |
| Prokip Updates | `order.updated` | Refunds & cancellations |
| Prokip Products | `product.updated` | Inventory sync |

### 3. Important Settings:

- **Status**: Active
- **Webhook Version**: WP API v3
- **Action**: `publish` (for orders)
- **API Version**: Legacy v3

## 🔧 Ngrok Configuration

If ngrok isn't working, make sure:

1. **Ngrok is running:**
```bash
ngrok http 3000
```

2. **Forwarding to correct port:**
   - Should show: `http://localhost:3000`

3. **Your ngrok URL should be:**
   - `https://nonluminous-flawed-lonny.ngrok-free.dev`

## 🔄 Bidirectional Sync Flow

### WooCommerce → Prokip (Automatic)

1. **Order Created** in WooCommerce
2. **Webhook Sent** to your ngrok URL
3. **System Processes:**
   - ✅ Verifies webhook signature
   - ✅ Checks order payment status
   - ✅ Maps order to Prokip format
   - ✅ Creates sale in Prokip
   - ✅ **Automatically deducts stock** in Prokip
   - ✅ Logs transaction for tracking

### Prokip → WooCommerce (Manual/Scheduled)

1. **Stock Updated** in Prokip
2. **Sync Triggered** from dashboard or cron
3. **System Updates** WooCommerce inventory
4. **Logs** sync operation

## 🧪 Testing Your Integration

### Test Webhook Delivery:

1. **Create a test order** in WooCommerce
2. **Set status to "Completed"**
3. **Check your server logs** for webhook processing

### Expected Log Output:
```
🔔 WooCommerce webhook received!
Topic: order.created
Order ID: 12345
Order Status: completed
✓ Sale recorded in Prokip for order 12345
✓ Automatically deducted stock for SKU ABC-001: 2 units
✓ Stock automatically reduced in Prokip for order 12345
```

### Test Stock Deduction:

1. **Check stock in Prokip** before order
2. **Create order with that product**
3. **Verify stock reduced** in Prokip
4. **Check sales log** for confirmation

## 📊 Monitoring & Logs

### Key Database Tables:
- `salesLog` - Order processing records
- `inventoryLog` - Stock synchronization
- `webhookEvent` - Webhook delivery tracking
- `syncError` - Error tracking

### Log Locations:
- **Console logs** in your terminal
- **Database logs** via admin dashboard
- **WooCommerce webhook logs**

## 🚨 Troubleshooting

### Ngrok Issues:
- **404 Errors**: Ngrok not running or wrong URL
- **Connection Refused**: Ngrok not forwarding to port 3000

### Webhook Issues:
- **Not Receiving**: Check WooCommerce webhook status
- **Processing Errors**: Check server console logs
- **Stock Not Deducting**: Verify Prokip authentication

### Common Solutions:
1. **Restart ngrok** if connection drops
2. **Check webhook secret** matches in WooCommerce
3. **Verify order status** is "completed" or "processing"
4. **Ensure Prokip credentials** are valid

## 🎯 Success Indicators

Your integration is working when:

- ✅ **Webhooks deliver** successfully (200 OK response)
- ✅ **Orders appear** in sales log with `prokipSellId`
- ✅ **Stock reduces** in Prokip after WooCommerce sales
- ✅ **No error logs** in console
- ✅ **Dashboard shows** sync activity

## 📞 Support

If issues persist:
1. **Check console logs** for detailed errors
2. **Verify ngrok tunnel** is active
3. **Test webhook manually** using curl/Postman
4. **Check WooCommerce webhook delivery logs**

---

**🎉 Your system is ready! Just configure the WooCommerce webhooks and start testing!**
