<?php
/**
 * Prokip E-commerce Integration - Store Connection Page
 */

if (!defined('ABSPATH')) {
    exit;
}

$store_model = new ProkipEcommerceStore();
$editing_store = null;
$edit_mode = false;

// Handle edit mode
if (isset($_GET['edit']) && is_numeric($_GET['edit'])) {
    $editing_store = $store_model->get_by_id(intval($_GET['edit']));
    $edit_mode = !empty($editing_store);
}

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['prokip_store_nonce'])) {
    if (wp_verify_nonce($_POST['prokip_store_nonce'], 'prokip_save_store')) {
        $store_data = [
            'platform' => sanitize_text_field($_POST['platform']),
            'store_url' => esc_url_raw($_POST['store_url']),
            'store_name' => sanitize_text_field($_POST['store_name']),
            'api_key' => sanitize_text_field($_POST['api_key']),
            'api_secret' => sanitize_text_field($_POST['api_secret']),
            'sync_enabled' => isset($_POST['sync_enabled'])
        ];

        if ($edit_mode) {
            $result = $store_model->update($editing_store->id, $store_data);
            $message = $result ? __('Store updated successfully!', 'prokip-ecommerce') : __('Failed to update store.', 'prokip-ecommerce');
        } else {
            $result = $store_model->create($store_data);
            $message = is_wp_error($result) ? $result->get_error_message() : __('Store connected successfully!', 'prokip-ecommerce');
        }

        if (!is_wp_error($result)) {
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($message) . '</p></div>';
        } else {
            echo '<div class="notice notice-error is-dismissible"><p>' . esc_html($message) . '</p></div>';
        }
    }
}

// Handle store deletion
if (isset($_GET['delete']) && is_numeric($_GET['delete']) && isset($_GET['_wpnonce'])) {
    if (wp_verify_nonce($_GET['_wpnonce'], 'prokip_delete_store_' . intval($_GET['delete']))) {
        $result = $store_model->delete(intval($_GET['delete']));
        $message = $result ? __('Store disconnected successfully!', 'prokip-ecommerce') : __('Failed to disconnect store.', 'prokip-ecommerce');
        
        echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($message) . '</p></div>';
    }
}

$stores = $store_model->get_all_for_user();
?>

<div class="wrap">
    <h1>
        <?php _e('Store Connections', 'prokip-ecommerce'); ?>
        <a href="<?php echo admin_url('admin.php?page=prokip-ecommerce'); ?>" class="page-title-action">
            <?php _e('Back to Dashboard', 'prokip-ecommerce'); ?>
        </a>
    </h1>

    <?php if ($edit_mode): ?>
        <h2><?php _e('Edit Store Connection', 'prokip-ecommerce'); ?></h2>
    <?php else: ?>
        <h2><?php _e('Connect New Store', 'prokip-ecommerce'); ?></h2>
    <?php endif; ?>

    <form method="post" id="prokip-store-form" class="prokip-form">
        <?php wp_nonce_field('prokip_save_store', 'prokip_store_nonce'); ?>
        
        <table class="form-table">
            <tr>
                <th scope="row">
                    <label for="platform"><?php _e('Platform', 'prokip-ecommerce'); ?> <span class="required">*</span></label>
                </th>
                <td>
                    <select name="platform" id="platform" required <?php echo $edit_mode ? 'disabled' : ''; ?>>
                        <option value=""><?php _e('Select Platform', 'prokip-ecommerce'); ?></option>
                        <option value="woocommerce" <?php echo ($edit_mode && $editing_store->platform === 'woocommerce') ? 'selected' : ''; ?>>
                            <?php _e('WooCommerce', 'prokip-ecommerce'); ?>
                        </option>
                        <option value="shopify" <?php echo ($edit_mode && $editing_store->platform === 'shopify') ? 'selected' : ''; ?>>
                            <?php _e('Shopify', 'prokip-ecommerce'); ?>
                        </option>
                    </select>
                    <p class="description"><?php _e('Choose your e-commerce platform', 'prokip-ecommerce'); ?></p>
                </td>
            </tr>

            <tr>
                <th scope="row">
                    <label for="store_url"><?php _e('Store URL', 'prokip-ecommerce'); ?> <span class="required">*</span></label>
                </th>
                <td>
                    <input type="url" name="store_url" id="store_url" value="<?php echo $edit_mode ? esc_attr($editing_store->store_url) : ''; ?>" class="regular-text" required>
                    <p class="description">
                        <?php _e('Your store URL (e.g., https://mystore.com)', 'prokip-ecommerce'); ?>
                    </p>
                </td>
            </tr>

            <tr>
                <th scope="row">
                    <label for="store_name"><?php _e('Store Name', 'prokip-ecommerce'); ?></label>
                </th>
                <td>
                    <input type="text" name="store_name" id="store_name" value="<?php echo $edit_mode ? esc_attr($editing_store->store_name) : ''; ?>" class="regular-text">
                    <p class="description"><?php _e('A friendly name for your store (optional)', 'prokip-ecommerce'); ?></p>
                </td>
            </tr>

            <tr id="api_key_row">
                <th scope="row">
                    <label for="api_key"><?php _e('API Key / Consumer Key', 'prokip-ecommerce'); ?> <span class="required">*</span></label>
                </th>
                <td>
                    <input type="text" name="api_key" id="api_key" value="<?php echo $edit_mode ? esc_attr($editing_store->api_key) : ''; ?>" class="regular-text" required>
                    <p class="description" id="api_key_description">
                        <?php _e('Enter your API credentials', 'prokip-ecommerce'); ?>
                    </p>
                </td>
            </tr>

            <tr id="api_secret_row">
                <th scope="row">
                    <label for="api_secret"><?php _e('API Secret / Consumer Secret', 'prokip-ecommerce'); ?> <span class="required">*</span></label>
                </th>
                <td>
                    <input type="password" name="api_secret" id="api_secret" value="<?php echo $edit_mode ? '' : ''; ?>" class="regular-text" <?php echo $edit_mode ? '' : 'required'; ?>>
                    <p class="description" id="api_secret_description">
                        <?php _e('Enter your API secret', 'prokip-ecommerce'); ?>
                    </p>
                </td>
            </tr>

            <tr>
                <th scope="row">
                    <label for="sync_enabled"><?php _e('Enable Sync', 'prokip-ecommerce'); ?></label>
                </th>
                <td>
                    <label>
                        <input type="checkbox" name="sync_enabled" id="sync_enabled" value="1" <?php echo ($edit_mode && $editing_store->sync_enabled) || !$edit_mode ? 'checked' : ''; ?>>
                        <?php _e('Enable automatic synchronization for this store', 'prokip-ecommerce'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <p class="submit">
            <button type="submit" class="button button-primary" id="test-connection-btn">
                <?php _e('Test Connection', 'prokip-ecommerce'); ?>
            </button>
            <button type="submit" class="button button-primary" id="save-store-btn" style="display: none;">
                <?php echo $edit_mode ? __('Update Store', 'prokip-ecommerce') : __('Connect Store', 'prokip-ecommerce'); ?>
            </button>
            <?php if ($edit_mode): ?>
                <a href="<?php echo admin_url('admin.php?page=prokip-ecommerce-stores'); ?>" class="button">
                    <?php _e('Cancel', 'prokip-ecommerce'); ?>
                </a>
            <?php endif; ?>
        </p>

        <div id="connection-status" style="margin-top: 20px;"></div>
    </form>

    <hr>

    <h2><?php _e('Connected Stores', 'prokip-ecommerce'); ?></h2>

    <?php if (empty($stores)): ?>
        <div class="notice notice-info">
            <p><?php _e('No stores connected yet. Connect your first store above to get started.', 'prokip-ecommerce'); ?></p>
        </div>
    <?php else: ?>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th><?php _e('Store Name', 'prokip-ecommerce'); ?></th>
                    <th><?php _e('Platform', 'prokip-ecommerce'); ?></th>
                    <th><?php _e('URL', 'prokip-ecommerce'); ?></th>
                    <th><?php _e('Status', 'prokip-ecommerce'); ?></th>
                    <th><?php _e('Last Sync', 'prokip-ecommerce'); ?></th>
                    <th><?php _e('Actions', 'prokip-ecommerce'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($stores as $store): ?>
                    <tr>
                        <td>
                            <strong><?php echo esc_html($store->store_name); ?></strong>
                        </td>
                        <td>
                            <span class="platform-badge platform-<?php echo esc_attr($store->platform); ?>">
                                <?php echo ucfirst(esc_html($store->platform)); ?>
                            </span>
                        </td>
                        <td>
                            <a href="<?php echo esc_url($store->store_url); ?>" target="_blank">
                                <?php echo esc_html($store->store_url); ?>
                            </a>
                        </td>
                        <td>
                            <span class="status-badge status-<?php echo $store->sync_enabled ? 'enabled' : 'disabled'; ?>">
                                <?php echo $store->sync_enabled ? __('Enabled', 'prokip-ecommerce') : __('Disabled', 'prokip-ecommerce'); ?>
                            </span>
                        </td>
                        <td>
                            <?php echo $store->last_sync ? date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($store->last_sync)) : __('Never', 'prokip-ecommerce'); ?>
                        </td>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=prokip-ecommerce-stores&edit=' . $store->id); ?>" class="button button-small">
                                <?php _e('Edit', 'prokip-ecommerce'); ?>
                            </a>
                            
                            <button type="button" class="button button-small" onclick="testStoreConnection(<?php echo $store->id; ?>)">
                                <?php _e('Test', 'prokip-ecommerce'); ?>
                            </button>
                            
                            <a href="<?php echo wp_nonce_url(admin_url('admin.php?page=prokip-ecommerce-stores&delete=' . $store->id), 'prokip_delete_store_' . $store->id); ?>" 
                               class="button button-small" 
                               onclick="return confirm('<?php _e('Are you sure you want to disconnect this store? This will stop all synchronization.', 'prokip-ecommerce'); ?>')">
                                <?php _e('Disconnect', 'prokip-ecommerce'); ?>
                            </a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Update form fields based on platform selection
    $('#platform').on('change', function() {
        var platform = $(this).val();
        updatePlatformFields(platform);
    });

    // Initialize platform fields
    var initialPlatform = $('#platform').val();
    if (initialPlatform) {
        updatePlatformFields(initialPlatform);
    }

    // Test connection button
    $('#test-connection-btn').on('click', function(e) {
        e.preventDefault();
        testConnection();
    });

    // Save store button
    $('#save-store-btn').on('click', function(e) {
        e.preventDefault();
        $('#prokip-store-form').submit();
    });
});

function updatePlatformFields(platform) {
    var apiKeyLabel = $('#api_key_row th label');
    var apiSecretLabel = $('#api_secret_row th label');
    var apiKeyDesc = $('#api_key_description');
    var apiSecretDesc = $('#api_secret_description');

    if (platform === 'woocommerce') {
        apiKeyLabel.text('<?php _e('Consumer Key', 'prokip-ecommerce'); ?> *');
        apiSecretLabel.text('<?php _e('Consumer Secret', 'prokip-ecommerce'); ?> *');
        apiKeyDesc.text('<?php _e('Get this from WooCommerce > Settings > Advanced > REST API', 'prokip-ecommerce'); ?>');
        apiSecretDesc.text('<?php _e('Get this from WooCommerce > Settings > Advanced > REST API', 'prokip-ecommerce'); ?>');
    } else if (platform === 'shopify') {
        apiKeyLabel.text('<?php _e('Access Token', 'prokip-ecommerce'); ?> *');
        apiSecretLabel.text('<?php _e('API Secret (for webhooks)', 'prokip-ecommerce'); ?>');
        apiKeyDesc.text('<?php _e('Get this from your Shopify App settings', 'prokip-ecommerce'); ?>');
        apiSecretDesc.text('<?php _e('Optional: Used for webhook verification', 'prokip-ecommerce'); ?>');
        $('#api_secret').prop('required', false);
    } else {
        apiKeyLabel.text('<?php _e('API Key', 'prokip-ecommerce'); ?> *');
        apiSecretLabel.text('<?php _e('API Secret', 'prokip-ecommerce'); ?> *');
        apiKeyDesc.text('<?php _e('Enter your API credentials', 'prokip-ecommerce'); ?>');
        apiSecretDesc.text('<?php _e('Enter your API secret', 'prokip-ecommerce'); ?>');
    }
}

function testConnection() {
    var platform = $('#platform').val();
    var storeUrl = $('#store_url').val();
    var apiKey = $('#api_key').val();
    var apiSecret = $('#api_secret').val();

    if (!platform || !storeUrl || !apiKey) {
        showConnectionStatus('<?php _e('Please fill in all required fields.', 'prokip-ecommerce'); ?>', 'error');
        return;
    }

    showConnectionStatus('<?php _e('Testing connection...', 'prokip-ecommerce'); ?>', 'info');

    $.ajax({
        url: '<?php echo rest_url('prokip-ecommerce/v1/test-connection'); ?>',
        method: 'POST',
        data: {
            platform: platform,
            store_url: storeUrl,
            api_key: apiKey,
            api_secret: apiSecret
        },
        success: function(response) {
            if (response.success) {
                showConnectionStatus('<?php _e('Connection successful! You can now save the store.', 'prokip-ecommerce'); ?>', 'success');
                $('#test-connection-btn').hide();
                $('#save-store-btn').show();
            } else {
                showConnectionStatus(response.message || '<?php _e('Connection failed. Please check your credentials.', 'prokip-ecommerce'); ?>', 'error');
            }
        },
        error: function() {
            showConnectionStatus('<?php _e('Network error. Please try again.', 'prokip-ecommerce'); ?>', 'error');
        }
    });
}

function testStoreConnection(storeId) {
    showConnectionStatus('<?php _e('Testing connection...', 'prokip-ecommerce'); ?>', 'info');

    $.ajax({
        url: '<?php echo rest_url('prokip-ecommerce/v1/test-store-connection'); ?>',
        method: 'POST',
        data: {
            store_id: storeId
        },
        success: function(response) {
            if (response.success) {
                showConnectionStatus('<?php _e('Connection successful!', 'prokip-ecommerce'); ?>', 'success');
            } else {
                showConnectionStatus(response.message || '<?php _e('Connection failed.', 'prokip-ecommerce'); ?>', 'error');
            }
        },
        error: function() {
            showConnectionStatus('<?php _e('Network error. Please try again.', 'prokip-ecommerce'); ?>', 'error');
        }
    });
}

function showConnectionStatus(message, type) {
    var statusDiv = $('#connection-status');
    var className = type === 'success' ? 'notice-success' : (type === 'error' ? 'notice-error' : 'notice-info');
    
    statusDiv.html('<div class="notice ' + className + ' is-dismissible"><p>' + message + '</p></div>');
    
    // Auto-dismiss success messages after 5 seconds
    if (type === 'success') {
        setTimeout(function() {
            statusDiv.find('.notice').fadeOut(function() {
                $(this).remove();
            });
        }, 5000);
    }
}
</script>

<style>
.prokip-form {
    background: #fff;
    border: 1px solid #ccd0d4;
    border-radius: 4px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.04);
}

.platform-badge {
    background: #0073aa;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: bold;
}

.platform-badge.platform-shopify {
    background: #95bf47;
}

.status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
}

.status-badge.status-enabled {
    background: #46b450;
    color: white;
}

.status-badge.status-disabled {
    background: #dc3232;
    color: white;
}

.required {
    color: #dc3232;
}
</style>
