# Setup with Public IP (Advanced)

## Your Information
- **Public IP**: `102.204.198.104`
- **Local IP**: `192.168.100.2`

## Webhook URL to Use
```
http://102.204.198.104:3000/connections/webhook/woocommerce
```

## Required Steps

### 1. Open Port 3000 in Windows Firewall
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Prokip Webhook Port" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow
```

### 2. Configure Router/Network
- Log into your router
- Port forward port 3000 to your computer (192.168.100.2)
- Or enable UPnP if available

### 3. Test Port Accessibility
```bash
# Test from another device
curl http://102.204.198.104:3000/sync/status
```

## Alternative: Use Local Network
If your WooCommerce site is on the same network:
```
http://192.168.100.2:3000/connections/webhook/woocommerce
```

## Warning
- Public IP exposes your server to internet
- Make sure your firewall is properly configured
- Consider security implications
