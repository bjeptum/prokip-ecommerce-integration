<?php
/**
 * Prokip E-commerce Integration - Dashboard Page
 */

if (!defined('ABSPATH')) {
    exit;
}

$current_user = wp_get_current_user();
$stores = $this->store_model->get_all_for_user();
?>

<div class="wrap">
    <h1><?php _e('Prokip E-commerce Integration', 'prokip-ecommerce'); ?></h1>
    
    <div class="prokip-dashboard">
        <!-- Overview Cards -->
        <div class="prokip-cards">
            <div class="prokip-card">
                <h3><?php _e('Connected Stores', 'prokip-ecommerce'); ?></h3>
                <div class="prokip-card-number"><?php echo count($stores); ?></div>
            </div>
            
            <div class="prokip-card">
                <h3><?php _e('Sync Status', 'prokip-ecommerce'); ?></h3>
                <div class="prokip-card-status">
                    <?php 
                    $enabled_stores = array_filter($stores, function($store) {
                        return $store->sync_enabled;
                    });
                    echo count($enabled_stores) . ' ' . __('Active', 'prokip-ecommerce');
                    ?>
                </div>
            </div>
            
            <div class="prokip-card">
                <h3><?php _e('Last Sync', 'prokip-ecommerce'); ?></h3>
                <div class="prokip-card-date">
                    <?php 
                    $last_sync = '';
                    foreach ($stores as $store) {
                        if ($store->last_sync && $store->last_sync > $last_sync) {
                            $last_sync = $store->last_sync;
                        }
                    }
                    echo $last_sync ? date_i18n(get_option('date_format'), strtotime($last_sync)) : __('Never', 'prokip-ecommerce');
                    ?>
                </div>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="prokip-section">
            <h2><?php _e('Quick Actions', 'prokip-ecommerce'); ?></h2>
            <div class="prokip-actions">
                <button type="button" class="button button-primary" onclick="prokipSyncAllInventory()">
                    <?php _e('Sync All Inventory', 'prokip-ecommerce'); ?>
                </button>
                
                <button type="button" class="button" onclick="prokipSyncAllProducts()">
                    <?php _e('Sync All Products', 'prokip-ecommerce'); ?>
                </button>
                
                <button type="button" class="button" onclick="prokipSyncAllOrders()">
                    <?php _e('Sync All Orders', 'prokip-ecommerce'); ?>
                </button>
            </div>
        </div>

        <!-- Connected Stores -->
        <div class="prokip-section">
            <h2><?php _e('Connected Stores', 'prokip-ecommerce'); ?></h2>
            
            <?php if (empty($stores)): ?>
                <div class="notice notice-info">
                    <p><?php _e('No stores connected yet. Connect your first store to get started.', 'prokip-ecommerce'); ?></p>
                    <p>
                        <a href="<?php echo admin_url('admin.php?page=prokip-ecommerce-stores'); ?>" class="button button-primary">
                            <?php _e('Connect Store', 'prokip-ecommerce'); ?>
                        </a>
                    </p>
                </div>
            <?php else: ?>
                <div class="prokip-stores-grid">
                    <?php foreach ($stores as $store): ?>
                        <div class="prokip-store-card">
                            <div class="prokip-store-header">
                                <h3><?php echo esc_html($store->store_name); ?></h3>
                                <span class="prokip-platform-badge prokip-<?php echo esc_attr($store->platform); ?>">
                                    <?php echo ucfirst(esc_html($store->platform)); ?>
                                </span>
                            </div>
                            
                            <div class="prokip-store-info">
                                <p><strong><?php _e('URL:', 'prokip-ecommerce'); ?></strong> <?php echo esc_html($store->store_url); ?></p>
                                <p><strong><?php _e('Status:', 'prokip-ecommerce'); ?></strong> 
                                    <span class="prokip-status prokip-<?php echo $store->sync_enabled ? 'enabled' : 'disabled'; ?>">
                                        <?php echo $store->sync_enabled ? __('Enabled', 'prokip-ecommerce') : __('Disabled', 'prokip-ecommerce'); ?>
                                    </span>
                                </p>
                                <p><strong><?php _e('Last Sync:', 'prokip-ecommerce'); ?></strong> 
                                    <?php echo $store->last_sync ? date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($store->last_sync)) : __('Never', 'prokip-ecommerce'); ?>
                                </p>
                            </div>
                            
                            <div class="prokip-store-actions">
                                <button type="button" class="button button-small" onclick="prokipSyncStore(<?php echo $store->id; ?>, 'inventory')">
                                    <?php _e('Sync Inventory', 'prokip-ecommerce'); ?>
                                </button>
                                
                                <button type="button" class="button button-small" onclick="prokipSyncStore(<?php echo $store->id; ?>, 'products')">
                                    <?php _e('Sync Products', 'prokip-ecommerce'); ?>
                                </button>
                                
                                <button type="button" class="button button-small" onclick="prokipSyncStore(<?php echo $store->id; ?>, 'orders')">
                                    <?php _e('Sync Orders', 'prokip-ecommerce'); ?>
                                </button>
                                
                                <a href="<?php echo admin_url('admin.php?page=prokip-ecommerce-stores&edit=' . $store->id); ?>" class="button button-small">
                                    <?php _e('Edit', 'prokip-ecommerce'); ?>
                                </a>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>

        <!-- Recent Activity -->
        <div class="prokip-section">
            <h2><?php _e('Recent Activity', 'prokip-ecommerce'); ?></h2>
            <div id="prokip-activity-log">
                <p><?php _e('Loading recent activity...', 'prokip-ecommerce'); ?></p>
            </div>
        </div>
    </div>
</div>

<!-- JavaScript for dashboard functionality -->
<script type="text/javascript">
jQuery(document).ready(function($) {
    // Load recent activity
    loadRecentActivity();
    
    // Auto-refresh activity every 30 seconds
    setInterval(loadRecentActivity, 30000);
});

function loadRecentActivity() {
    jQuery.ajax({
        url: '<?php echo rest_url('prokip-ecommerce/v1/activity'); ?>',
        method: 'GET',
        success: function(response) {
            var html = '';
            if (response.success && response.activities && response.activities.length > 0) {
                html = '<div class="prokip-activity-list">';
                response.activities.forEach(function(activity) {
                    html += '<div class="prokip-activity-item">';
                    html += '<span class="prokip-activity-time">' + activity.time + '</span>';
                    html += '<span class="prokip-activity-message">' + activity.message + '</span>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html = '<p><?php _e('No recent activity found.', 'prokip-ecommerce'); ?></p>';
            }
            jQuery('#prokip-activity-log').html(html);
        },
        error: function() {
            jQuery('#prokip-activity-log').html('<p><?php _e('Failed to load activity.', 'prokip-ecommerce'); ?></p>');
        }
    });
}

function prokipSyncAllInventory() {
    if (!confirm('<?php _e('Are you sure you want to sync inventory from Prokip to all connected stores?', 'prokip-ecommerce'); ?>')) {
        return;
    }
    
    showLoadingOverlay();
    
    jQuery.ajax({
        url: '<?php echo rest_url('prokip-ecommerce/v1/sync-all-inventory'); ?>',
        method: 'POST',
        success: function(response) {
            hideLoadingOverlay();
            if (response.success) {
                showNotice(response.message, 'success');
                loadRecentActivity();
            } else {
                showNotice(response.message || '<?php _e('Sync failed.', 'prokip-ecommerce'); ?>', 'error');
            }
        },
        error: function() {
            hideLoadingOverlay();
            showNotice('<?php _e('Network error occurred.', 'prokip-ecommerce'); ?>', 'error');
        }
    });
}

function prokipSyncAllProducts() {
    if (!confirm('<?php _e('Are you sure you want to sync products from all stores to Prokip?', 'prokip-ecommerce'); ?>')) {
        return;
    }
    
    showLoadingOverlay();
    
    jQuery.ajax({
        url: '<?php echo rest_url('prokip-ecommerce/v1/sync-all-products'); ?>',
        method: 'POST',
        success: function(response) {
            hideLoadingOverlay();
            if (response.success) {
                showNotice(response.message, 'success');
                loadRecentActivity();
            } else {
                showNotice(response.message || '<?php _e('Sync failed.', 'prokip-ecommerce'); ?>', 'error');
            }
        },
        error: function() {
            hideLoadingOverlay();
            showNotice('<?php _e('Network error occurred.', 'prokip-ecommerce'); ?>', 'error');
        }
    });
}

function prokipSyncAllOrders() {
    if (!confirm('<?php _e('Are you sure you want to sync orders from all stores to Prokip?', 'prokip-ecommerce'); ?>')) {
        return;
    }
    
    showLoadingOverlay();
    
    jQuery.ajax({
        url: '<?php echo rest_url('prokip-ecommerce/v1/sync-all-orders'); ?>',
        method: 'POST',
        success: function(response) {
            hideLoadingOverlay();
            if (response.success) {
                showNotice(response.message, 'success');
                loadRecentActivity();
            } else {
                showNotice(response.message || '<?php _e('Sync failed.', 'prokip-ecommerce'); ?>', 'error');
            }
        },
        error: function() {
            hideLoadingOverlay();
            showNotice('<?php _e('Network error occurred.', 'prokip-ecommerce'); ?>', 'error');
        }
    });
}

function prokipSyncStore(storeId, type) {
    var messages = {
        inventory: '<?php _e('Are you sure you want to sync inventory for this store?', 'prokip-ecommerce'); ?>',
        products: '<?php _e('Are you sure you want to sync products for this store?', 'prokip-ecommerce'); ?>',
        orders: '<?php _e('Are you sure you want to sync orders for this store?', 'prokip-ecommerce'); ?>'
    };
    
    if (!confirm(messages[type])) {
        return;
    }
    
    showLoadingOverlay();
    
    jQuery.ajax({
        url: '<?php echo rest_url('prokip-ecommerce/v1/sync-'); ?>' + type,
        method: 'POST',
        data: {
            store_id: storeId
        },
        success: function(response) {
            hideLoadingOverlay();
            if (response.success) {
                showNotice(response.message, 'success');
                loadRecentActivity();
            } else {
                showNotice(response.message || '<?php _e('Sync failed.', 'prokip-ecommerce'); ?>', 'error');
            }
        },
        error: function() {
            hideLoadingOverlay();
            showNotice('<?php _e('Network error occurred.', 'prokip-ecommerce'); ?>', 'error');
        }
    });
}

function showLoadingOverlay() {
    jQuery('body').append('<div class="prokip-loading-overlay"><div class="prokip-spinner"></div></div>');
}

function hideLoadingOverlay() {
    jQuery('.prokip-loading-overlay').remove();
}

function showNotice(message, type) {
    var className = type === 'success' ? 'notice-success' : 'notice-error';
    var notice = '<div class="notice ' + className + ' is-dismissible"><p>' + message + '</p></div>';
    jQuery('.wrap h1').after(notice);
    
    // Auto-dismiss after 5 seconds
    setTimeout(function() {
        jQuery('.notice.is-dismissible').fadeOut(function() {
            jQuery(this).remove();
        });
    }, 5000);
}
</script>

<style>
.prokip-dashboard {
    margin-top: 20px;
}

.prokip-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.prokip-card {
    background: #fff;
    border: 1px solid #ccd0d4;
    border-radius: 4px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 1px 1px rgba(0,0,0,0.04);
}

.prokip-card h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #666;
}

.prokip-card-number {
    font-size: 32px;
    font-weight: bold;
    color: #0073aa;
}

.prokip-card-status {
    font-size: 18px;
    font-weight: bold;
    color: #46b450;
}

.prokip-card-date {
    font-size: 16px;
    color: #666;
}

.prokip-section {
    background: #fff;
    border: 1px solid #ccd0d4;
    border-radius: 4px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.04);
}

.prokip-section h2 {
    margin: 0 0 20px 0;
    font-size: 18px;
    color: #23282d;
}

.prokip-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.prokip-stores-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
}

.prokip-store-card {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 15px;
    background: #fafafa;
}

.prokip-store-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.prokip-store-header h3 {
    margin: 0;
    font-size: 16px;
}

.prokip-platform-badge {
    background: #0073aa;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: bold;
}

.prokip-platform-badge.prokip-shopify {
    background: #95bf47;
}

.prokip-store-info p {
    margin: 5px 0;
    font-size: 13px;
}

.prokip-status.prokip-enabled {
    color: #46b450;
    font-weight: bold;
}

.prokip-status.prokip-disabled {
    color: #dc3232;
    font-weight: bold;
}

.prokip-store-actions {
    margin-top: 15px;
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}

.prokip-activity-list {
    max-height: 200px;
    overflow-y: auto;
}

.prokip-activity-item {
    padding: 8px 0;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.prokip-activity-item:last-child {
    border-bottom: none;
}

.prokip-activity-time {
    font-size: 12px;
    color: #666;
    min-width: 120px;
}

.prokip-activity-message {
    font-size: 13px;
    flex: 1;
}

.prokip-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999999;
}

.prokip-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #0073aa;
    border-radius: 50%;
    animation: prokip-spin 1s linear infinite;
}

@keyframes prokip-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
