# Using ngrok for WooCommerce Webhooks

## Quick Setup (5 minutes)

### Step 1: Install ngrok
If you don't have ngrok:
```bash
# Download from https://ngrok.com/download
# Or use chocolatey: choco install ngrok
```

### Step 2: Start ngrok
```bash
ngrok http 3000
```

### Step 3: Get your public URL
ngrok will show you something like:
```
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

### Step 4: Use this URL in WooCommerce
Use: `https://abc123.ngrok.io/connections/webhook/woocommerce`

### Step 5: Update webhook URLs
Replace all instances of `http://localhost:3000` with your ngrok URL:
- Webhook 1: `https://abc123.ngrok.io/connections/webhook/woocommerce`
- Webhook 2: `https://abc123.ngrok.io/connections/webhook/woocommerce`  
- Webhook 3: `https://abc123.ngrok.io/connections/webhook/woocommerce`

## Important Notes
- ngrok URL changes each time you restart it
- For development, this is perfect
- For production, you'll need a real domain

## Testing with ngrok
After setting up ngrok:
1. Create webhooks in WooCommerce with the ngrok URL
2. Test by creating a completed order
3. Check: `node check-webhooks.js` to see if webhooks are received
