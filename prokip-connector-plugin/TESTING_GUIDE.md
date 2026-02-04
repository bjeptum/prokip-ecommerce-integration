# Prokip E-commerce Integration - Testing Guide

## 🧪 Quick Testing Steps

### 1. Plugin Installation Test
```bash
# Check if plugin files are in place
ls -la prokip-connector-plugin/

# Should see:
# - prokip-ecommerce-sync.php (main plugin file)
# - includes/ folder with PHP classes
# - admin/ folder with admin pages
# - assets/ folder with JS/CSS
# - README.md and documentation
```

### 2. WordPress Plugin Activation
1. Upload `prokip-connector-plugin` folder to `wp-content/plugins/`
2. Go to WordPress Admin → Plugins
3. Activate "Prokip E-commerce Integration"
4. Check for any activation errors

### 3. Database Setup Test
```sql
-- Check if database tables were created
SHOW TABLES LIKE 'wp_prokip_%';

-- Should see:
-- - wp_prokip_ecommerce_stores
-- - wp_prokip_processed_orders
```

### 4. Admin Interface Test
1. Go to WordPress Admin
2. Look for "Prokip E-commerce" menu
3. Navigate to:
   - Dashboard (overview page)
   - Store Connections (manage stores)
   - Settings (configuration)

### 5. Run the Test Suite
```bash
# Navigate to plugin directory
cd wp-content/plugins/prokip-connector-plugin

# Run the comprehensive test
php test-integration.php
```

## 🔍 Detailed Testing Checklist

### ✅ Plugin Files Verification
- [ ] Main plugin file exists and is properly formatted
- [ ] All include files are present
- [ ] Admin pages are created
- [ ] Assets (JS/CSS) are included

### ✅ WordPress Integration
- [ ] Plugin activates without errors
- [ ] Admin menu appears correctly
- [ ] Database tables are created
- [ ] REST API endpoints are registered

### ✅ Prokip Connection Test
- [ ] Prokip API credentials can be configured
- [ ] Connection test works
- [ ] Authentication succeeds

### ✅ Store Connection Test
- [ ] Can add WooCommerce store
- [ ] Store connection test passes
- [ ] Webhooks can be configured

### ✅ Synchronization Test
- [ ] Manual product sync works
- [ ] Manual order sync works
- [ ] Manual inventory sync works
- [ ] Webhook processing works

## 🚨 Common Issues & Solutions

### Plugin Won't Activate
**Issue**: PHP fatal error or missing dependencies
**Solution**: Check PHP version (requires 7.4+) and WordPress version (requires 5.0+)

### Database Tables Missing
**Issue**: Tables not created on activation
**Solution**: Deactivate and reactivate plugin, or run:
```sql
CREATE TABLE wp_prokip_ecommerce_stores (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    user_id bigint(20) unsigned NOT NULL,
    platform varchar(255) NOT NULL,
    store_url varchar(255) NOT NULL,
    store_name varchar(255) DEFAULT NULL,
    api_key text,
    api_secret text,
    access_token text,
    refresh_token text,
    sync_enabled boolean DEFAULT 1,
    last_sync datetime DEFAULT NULL,
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY user_store (user_id, platform, store_url)
);
```

### Prokip Connection Fails
**Issue**: Invalid credentials or network issues
**Solution**: 
1. Verify Prokip API URL: `https://api.prokip.africa`
2. Check username/password are correct
3. Test network connectivity

### WooCommerce Connection Fails
**Issue**: Invalid API keys or permissions
**Solution**:
1. Generate new Consumer Key/Secret in WooCommerce
2. Ensure permissions are "Read/Write"
3. Verify store URL format (include https://)

### Webhooks Not Working
**Issue**: Webhooks not delivered or processed
**Solution**:
1. Check webhook URL is accessible
2. Verify webhook secrets match
3. Check webhook delivery logs in WooCommerce

## 🛠️ Debug Tools

### Enable WordPress Debug
Add to `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

### Check Error Logs
```bash
# WordPress debug log
tail -f wp-content/debug.log

# Web server error log
tail -f /var/log/apache2/error.log
# or
tail -f /var/log/nginx/error.log
```

### Test REST API Endpoints
```bash
# Test if endpoints are registered
curl -X GET "https://yoursite.com/wp-json/prokip-ecommerce/v1/stores"

# Should return JSON response or authentication error
```

### Database Queries for Testing
```sql
-- Check connected stores
SELECT * FROM wp_prokip_ecommerce_stores;

-- Check processed orders
SELECT * FROM wp_prokip_processed_orders;

-- Check recent activity
SELECT * FROM wp_prokip_webhook_events ORDER BY created_at DESC LIMIT 10;
```

## 📊 Performance Testing

### Load Testing
1. Test with 100+ products
2. Test with 50+ orders
3. Monitor memory usage
4. Check response times

### Stress Testing
1. Simulate multiple webhook calls
2. Test concurrent sync operations
3. Monitor database performance

## ✅ Success Criteria

The integration is working correctly when:

1. **Plugin activates** without errors
2. **Admin interface** loads and functions properly
3. **Prokip connection** test succeeds
4. **Store connection** can be established
5. **Manual sync** operations complete successfully
6. **Webhooks** are received and processed
7. **Stock levels** update in both directions
8. **Error handling** works gracefully
9. **Logs** show proper activity tracking
10. **Performance** remains acceptable under load

## 🆘 Getting Help

If tests fail:
1. Check WordPress debug logs
2. Verify all file permissions
3. Test database connectivity
4. Validate API credentials
5. Check network connectivity
6. Review plugin documentation

## 📞 Support Resources

- Plugin documentation: `README.md`
- Test suite: `test-integration.php`
- Implementation guide: `IMPLEMENTATION_COMPLETE.md`
- WordPress codex for debugging
- WooCommerce API documentation
