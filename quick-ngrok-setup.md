# Quick ngrok Setup (2 minutes)

## Step 1: Download ngrok
Go to https://ngrok.com/download and download for Windows

## Step 2: Run ngrok
```bash
ngrok http 3000
```

## Step 3: Copy your ngrok URL
ngrok will show something like:
```
Forwarding  https://1a2b-3c4d-5e6f.ngrok.io -> http://localhost:3000
```

## Step 4: Use this URL in WooCommerce
Replace `http://localhost:3000` with your ngrok URL:
```
https://1a2b-3c4d-5e6f.ngrok.io/connections/webhook/woocommerce
```

## Benefits
- ✅ Works immediately
- ✅ No firewall configuration needed
- ✅ HTTPS (secure)
- ✅ Perfect for testing

## Note
- Free ngrok URL changes each time you restart
- For development, this is perfect
