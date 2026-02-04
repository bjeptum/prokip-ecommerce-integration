# Prokip E-commerce Integration Plugin

A comprehensive WordPress plugin that integrates WooCommerce and Shopify stores with the Prokip inventory management system, providing bidirectional stock synchronization in real-time.

## Features

### 🔌 Multi-Platform Support
- **WooCommerce**: Full REST API integration with webhook support
- **Shopify**: OAuth 2.0 integration with automatic webhook registration
- **Multiple Stores**: Connect unlimited stores simultaneously
- **Platform Agnostic**: Each store operates independently with unified inventory

### 🔄 Real-Time Bidirectional Sync
- **Prokip → Store**: Push inventory updates from Prokip to all connected stores
- **Store → Prokip**: Automatically deduct stock in Prokip when sales occur
- **Webhook-Driven**: Instant updates via platform webhooks
- **Manual Sync**: On-demand synchronization from admin dashboard

### 🎛️ Advanced Admin Interface
- **Modern Dashboard**: Overview of all connected stores and sync status
- **Store Management**: Add, edit, and test store connections
- **Sync Settings**: Configure automatic sync intervals and preferences
- **Activity Logs**: View recent sync operations and webhook events
- **Real-Time Updates**: Live status updates and notifications

### 🔒 Enterprise Security
- **Encrypted Credentials**: All API keys and tokens are encrypted
- **Webhook Verification**: HMAC signature verification for all webhooks
- **User Permissions**: WordPress capability-based access control
- **Audit Trail**: Complete logging of all sync operations

## Installation

### Requirements
- WordPress 5.0 or higher
- PHP 7.4 or higher
- WooCommerce 3.0 or higher (for WooCommerce integration)
- Prokip account with API access

### Installation Steps

1. **Upload Plugin**
   ```bash
   # Upload the prokip-connector-plugin folder to your WordPress plugins directory
   wp plugin install prokip-connector-plugin --activate
   ```

2. **Configure Prokip API**
   - Navigate to **Prokip E-commerce → Settings**
   - Enter your Prokip API URL: `https://api.prokip.africa`
   - Enter your Prokip username and password
   - Click "Test Connection" to verify credentials

3. **Connect Your Store**
   - Navigate to **Prokip E-commerce → Store Connections**
   - Select your platform (WooCommerce or Shopify)
   - Enter your store URL and API credentials
   - Click "Test Connection" then "Connect Store"

4. **Configure Webhooks**
   - For WooCommerce: Add webhook URL to WooCommerce settings
   - For Shopify: Webhooks are automatically registered
   - Configure webhook secrets in the plugin settings

## Configuration

### WooCommerce Setup

1. **Generate API Keys**
   - Go to **WooCommerce → Settings → Advanced → REST API**
   - Click "Add Key"
   - Description: "Prokip Integration"
   - Permissions: "Read/Write"
   - Save the Consumer Key and Consumer Secret

2. **Configure Webhooks**
   - Go to **WooCommerce → Settings → Advanced → Webhooks**
   - Click "Add Webhook"
   - Name: "Prokip Webhook"
   - Status: "Active"
   - Topic: "Order Created", "Order Updated", "Product Updated"
   - Delivery URL: `https://yoursite.com/wp-json/prokip-ecommerce/v1/webhook/woocommerce`
   - Secret: Generate a random string (use the Generate button in plugin settings)

### Shopify Setup

1. **Create Shopify App**
   - Go to Shopify Partners and create a new app
   - Configure Admin API permissions:
     - `read_products`, `write_products`
     - `read_inventory`, `write_inventory`
     - `read_orders`, `write_orders`
   - Install the app and get the Access Token

2. **Connect in Plugin**
   - Enter your Shopify store URL (e.g., `mystore.myshopify.com`)
   - Enter the Access Token
   - Plugin will automatically register webhooks

## Usage

### Manual Synchronization

1. **From Dashboard**
   - Go to **Prokip E-commerce → Dashboard**
   - Use the quick action buttons to sync:
     - All Inventory (Prokip → Stores)
     - All Products (Stores → Prokip)
     - All Orders (Stores → Prokip)

2. **Per-Store Sync**
   - Go to **Prokip E-commerce → Store Connections**
   - Click the sync buttons next to each store

### Automatic Synchronization

1. **Configure Settings**
   - Go to **Prokip E-commerce → Settings**
   - Enable "Auto Sync"
   - Set sync interval (Hourly, Twice Daily, Daily)
   - Enable "Stock Deduction" for automatic order processing

2. **Webhook Processing**
   - Webhooks are processed in real-time
   - Orders are automatically processed and stock deducted in Prokip
   - Product updates are synchronized immediately

## API Endpoints

### Store Management
- `POST /wp-json/prokip-ecommerce/v1/connect-store` - Connect new store
- `DELETE /wp-json/prokip-ecommerce/v1/disconnect-store/{id}` - Disconnect store
- `GET /wp-json/prokip-ecommerce/v1/stores` - List connected stores

### Synchronization
- `POST /wp-json/prokip-ecommerce/v1/sync-products` - Sync products
- `POST /wp-json/prokip-ecommerce/v1/sync-orders` - Sync orders
- `POST /wp-json/prokip-ecommerce/v1/sync-inventory` - Sync inventory

### Webhooks
- `POST /wp-json/prokip-ecommerce/v1/webhook/{platform}` - Webhook endpoint

### Frontend
- `POST /wp-json/prokip-ecommerce/v1/products/sync` - Sync product data
- `POST /wp-json/prokip-ecommerce/v1/stock/check` - Check stock levels

## Database Schema

### Stores Table
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

### Processed Orders Table
```sql
CREATE TABLE wp_prokip_processed_orders (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    order_id varchar(255) NOT NULL,
    prokip_sell_id varchar(255) DEFAULT NULL,
    processed_at datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY order_id (order_id)
);
```

## Troubleshooting

### Common Issues

1. **Connection Test Fails**
   - Verify API credentials are correct
   - Check store URL format (include https://)
   - Ensure API permissions are correct
   - Check firewall/SSL certificate issues

2. **Webhooks Not Working**
   - Verify webhook URL is accessible
   - Check webhook secrets match
   - Ensure webhook topics are configured correctly
   - Check webhook delivery logs in your platform

3. **Sync Not Working**
   - Check Prokip API credentials
   - Verify sync is enabled for the store
   - Check cron jobs are running
   - Review error logs

### Debug Mode

Enable debug mode by adding to wp-config.php:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Check debug logs in `wp-content/debug.log` for detailed error information.

### Support

For issues and support:
1. Check the plugin documentation
2. Review WordPress debug logs
3. Test API connections manually
4. Contact Prokip support with error details

## Development

### Plugin Structure
```
prokip-connector-plugin/
├── prokip-ecommerce-sync.php          # Main plugin file
├── includes/
│   ├── class-ecommerce-store.php      # Store model
│   ├── class-ecommerce-service.php    # API service
│   ├── class-ecommerce-sync-controller.php # Sync controller
│   ├── class-webhook-handler.php      # Webhook processor
│   ├── api-endpoints.php              # REST API endpoints
│   └── cron-jobs.php                  # Scheduled tasks
├── admin/
│   └── pages/
│       ├── dashboard.php              # Admin dashboard
│       ├── stores.php                 # Store management
│       └── settings.php               # Plugin settings
└── assets/
    ├── js/
    │   ├── admin.js                   # Admin JavaScript
    │   └── frontend.js                # Frontend JavaScript
    └── css/
        ├── admin.css                  # Admin styles
        └── frontend.css               # Frontend styles
```

### Contributing

1. Follow WordPress coding standards
2. Use proper security practices (nonce verification, data sanitization)
3. Add proper error handling and logging
4. Test with both WooCommerce and Shopify
5. Document new features and API endpoints

## License

This plugin is licensed under the MIT License. See LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial release
- WooCommerce and Shopify integration
- Bidirectional stock synchronization
- Real-time webhook processing
- Admin dashboard and settings
- REST API endpoints
- Frontend integration support
