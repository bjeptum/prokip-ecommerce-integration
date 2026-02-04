<?php
/**
 * Prokip E-commerce Integration - Settings Page
 */

if (!defined('ABSPATH')) {
    exit;
}

// Handle settings save
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['prokip_settings_nonce'])) {
    if (wp_verify_nonce($_POST['prokip_settings_nonce'], 'prokip_save_settings')) {
        // Save Prokip API settings
        update_option('prokip_api_url', sanitize_url($_POST['prokip_api_url']));
        update_option('prokip_username', sanitize_text_field($_POST['prokip_username']));
        
        // Only update password if provided
        if (!empty($_POST['prokip_password'])) {
            update_option('prokip_password', sanitize_text_field($_POST['prokip_password']));
            // Clear existing token to force re-authentication
            delete_option('prokip_api_token');
        }

        // Save webhook settings
        update_option('prokip_woo_webhook_secret', sanitize_text_field($_POST['prokip_woo_webhook_secret']));
        update_option('prokip_shopify_webhook_secret', sanitize_text_field($_POST['prokip_shopify_webhook_secret']));

        // Save sync settings
        update_option('prokip_auto_sync_enabled', isset($_POST['prokip_auto_sync_enabled']));
        update_option('prokip_sync_interval', sanitize_text_field($_POST['prokip_sync_interval']));
        update_option('prokip_stock_deduction_enabled', isset($_POST['prokip_stock_deduction_enabled']));

        echo '<div class="notice notice-success is-dismissible"><p>' . __('Settings saved successfully!', 'prokip-ecommerce') . '</p></div>';
    }
}

// Get current settings
$prokip_api_url = get_option('prokip_api_url', 'https://api.prokip.africa');
$prokip_username = get_option('prokip_username');
$prokip_woo_webhook_secret = get_option('prokip_woo_webhook_secret');
$prokip_shopify_webhook_secret = get_option('prokip_shopify_webhook_secret');
$prokip_auto_sync_enabled = get_option('prokip_auto_sync_enabled', true);
$prokip_sync_interval = get_option('prokip_sync_interval', 'hourly');
$prokip_stock_deduction_enabled = get_option('prokip_stock_deduction_enabled', true);

// Test Prokip connection
$prokip_connection_status = '';
if (isset($_POST['test_prokip_connection'])) {
    $token = get_option('prokip_api_token');
    if (!$token && $prokip_username && get_option('prokip_password')) {
        // Try to authenticate
        $response = wp_remote_post($prokip_api_url . '/auth/login', [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'username' => $prokip_username,
                'password' => get_option('prokip_password')
            ]),
            'timeout' => 30
        ]);

        if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            $token = $data['token'] ?? null;
            
            if ($token) {
                update_option('prokip_api_token', $token);
            }
        }
    }

    if ($token) {
        $prokip_connection_status = '<div class="notice notice-success is-dismissible"><p>' . __('Successfully connected to Prokip API!', 'prokip-ecommerce') . '</p></div>';
    } else {
        $prokip_connection_status = '<div class="notice notice-error is-dismissible"><p>' . __('Failed to connect to Prokip API. Please check your credentials.', 'prokip-ecommerce') . '</p></div>';
    }
}
?>

<div class="wrap">
    <h1>
        <?php _e('Sync Settings', 'prokip-ecommerce'); ?>
        <a href="<?php echo admin_url('admin.php?page=prokip-ecommerce'); ?>" class="page-title-action">
            <?php _e('Back to Dashboard', 'prokip-ecommerce'); ?>
        </a>
    </h1>

    <form method="post" class="prokip-settings-form">
        <?php wp_nonce_field('prokip_save_settings', 'prokip_settings_nonce'); ?>

        <!-- Prokip API Settings -->
        <div class="prokip-settings-section">
            <h2><?php _e('Prokip API Settings', 'prokip-ecommerce'); ?></h2>
            
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="prokip_api_url"><?php _e('API URL', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <input type="url" name="prokip_api_url" id="prokip_api_url" value="<?php echo esc_attr($prokip_api_url); ?>" class="regular-text">
                        <p class="description"><?php _e('Your Prokip API endpoint URL', 'prokip-ecommerce'); ?></p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="prokip_username"><?php _e('Username', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <input type="text" name="prokip_username" id="prokip_username" value="<?php echo esc_attr($prokip_username); ?>" class="regular-text">
                        <p class="description"><?php _e('Your Prokip account username', 'prokip-ecommerce'); ?></p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="prokip_password"><?php _e('Password', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <input type="password" name="prokip_password" id="prokip_password" class="regular-text">
                        <p class="description"><?php _e('Your Prokip account password. Leave blank to keep current password.', 'prokip-ecommerce'); ?></p>
                    </td>
                </tr>
            </table>

            <p class="submit">
                <button type="submit" name="test_prokip_connection" class="button">
                    <?php _e('Test Connection', 'prokip-ecommerce'); ?>
                </button>
            </p>

            <?php echo $prokip_connection_status; ?>
        </div>

        <!-- Webhook Settings -->
        <div class="prokip-settings-section">
            <h2><?php _e('Webhook Settings', 'prokip-ecommerce'); ?></h2>
            
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="prokip_woo_webhook_secret"><?php _e('WooCommerce Webhook Secret', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <input type="text" name="prokip_woo_webhook_secret" id="prokip_woo_webhook_secret" value="<?php echo esc_attr($prokip_woo_webhook_secret); ?>" class="regular-text">
                        <p class="description">
                            <?php _e('Secret key for verifying WooCommerce webhooks. Generate a strong random string.', 'prokip-ecommerce'); ?>
                            <button type="button" class="button button-small" onclick="generateWebhookSecret('woo')">
                                <?php _e('Generate', 'prokip-ecommerce'); ?>
                            </button>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="prokip_shopify_webhook_secret"><?php _e('Shopify Webhook Secret', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <input type="text" name="prokip_shopify_webhook_secret" id="prokip_shopify_webhook_secret" value="<?php echo esc_attr($prokip_shopify_webhook_secret); ?>" class="regular-text">
                        <p class="description">
                            <?php _e('Secret key for verifying Shopify webhooks. Generate a strong random string.', 'prokip-ecommerce'); ?>
                            <button type="button" class="button button-small" onclick="generateWebhookSecret('shopify')">
                                <?php _e('Generate', 'prokip-ecommerce'); ?>
                            </button>
                        </p>
                    </td>
                </tr>
            </table>

            <div class="notice notice-info">
                <p><strong><?php _e('Webhook URL:', 'prokip-ecommerce'); ?></strong></p>
                <code><?php echo rest_url('prokip-ecommerce/v1/webhook/{platform}'); ?></code>
                <p><?php _e('Use this URL when configuring webhooks in your e-commerce platform. Replace {platform} with "woocommerce" or "shopify".', 'prokip-ecommerce'); ?></p>
            </div>
        </div>

        <!-- Sync Settings -->
        <div class="prokip-settings-section">
            <h2><?php _e('Synchronization Settings', 'prokip-ecommerce'); ?></h2>
            
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="prokip_auto_sync_enabled"><?php _e('Auto Sync', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <label>
                            <input type="checkbox" name="prokip_auto_sync_enabled" id="prokip_auto_sync_enabled" value="1" <?php echo $prokip_auto_sync_enabled ? 'checked' : ''; ?>>
                            <?php _e('Enable automatic synchronization', 'prokip-ecommerce'); ?>
                        </label>
                        <p class="description"><?php _e('Automatically sync data at regular intervals', 'prokip-ecommerce'); ?></p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="prokip_sync_interval"><?php _e('Sync Interval', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <select name="prokip_sync_interval" id="prokip_sync_interval">
                            <option value="hourly" <?php echo $prokip_sync_interval === 'hourly' ? 'selected' : ''; ?>>
                                <?php _e('Hourly', 'prokip-ecommerce'); ?>
                            </option>
                            <option value="twicedaily" <?php echo $prokip_sync_interval === 'twicedaily' ? 'selected' : ''; ?>>
                                <?php _e('Twice Daily', 'prokip-ecommerce'); ?>
                            </option>
                            <option value="daily" <?php echo $prokip_sync_interval === 'daily' ? 'selected' : ''; ?>>
                                <?php _e('Daily', 'prokip-ecommerce'); ?>
                            </option>
                        </select>
                        <p class="description"><?php _e('How often to run automatic synchronization', 'prokip-ecommerce'); ?></p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="prokip_stock_deduction_enabled"><?php _e('Stock Deduction', 'prokip-ecommerce'); ?></label>
                    </th>
                    <td>
                        <label>
                            <input type="checkbox" name="prokip_stock_deduction_enabled" id="prokip_stock_deduction_enabled" value="1" <?php echo $prokip_stock_deduction_enabled ? 'checked' : ''; ?>>
                            <?php _e('Enable automatic stock deduction in Prokip when orders are placed', 'prokip-ecommerce'); ?>
                        </label>
                        <p class="description"><?php _e('When enabled, stock will be automatically deducted from Prokip when orders are placed in connected stores', 'prokip-ecommerce'); ?></p>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Status Information -->
        <div class="prokip-settings-section">
            <h2><?php _e('System Status', 'prokip-ecommerce'); ?></h2>
            
            <table class="form-table">
                <tr>
                    <th scope="row"><?php _e('Plugin Version', 'prokip-ecommerce'); ?></th>
                    <td><?php echo PROKIP_ECOMMERCE_VERSION; ?></td>
                </tr>

                <tr>
                    <th scope="row"><?php _e('WordPress Version', 'prokip-ecommerce'); ?></th>
                    <td><?php echo get_bloginfo('version'); ?></td>
                </tr>

                <tr>
                    <th scope="row"><?php _e('PHP Version', 'prokip-ecommerce'); ?></th>
                    <td><?php echo PHP_VERSION; ?></td>
                </tr>

                <tr>
                    <th scope="row"><?php _e('Database Version', 'prokip-ecommerce'); ?></th>
                    <td><?php echo $GLOBALS['wpdb']->db_version(); ?></td>
                </tr>

                <tr>
                    <th scope="row"><?php _e('Last Cron Run', 'prokip-ecommerce'); ?></th>
                    <td>
                        <?php 
                        $last_cron = wp_next_scheduled('prokip_stock_sync');
                        echo $last_cron ? date_i18n(get_option('date_format') . ' ' . get_option('time_format'), $last_cron) : __('Not scheduled', 'prokip-ecommerce'); 
                        ?>
                    </td>
                </tr>

                <tr>
                    <th scope="row"><?php _e('Prokip Token Status', 'prokip-ecommerce'); ?></th>
                    <td>
                        <?php 
                        $token = get_option('prokip_api_token');
                        echo $token ? '<span style="color: #46b450;">' . __('Valid', 'prokip-ecommerce') . '</span>' : '<span style="color: #dc3232;">' . __('Not Set', 'prokip-ecommerce') . '</span>'; 
                        ?>
                    </td>
                </tr>
            </table>
        </div>

        <p class="submit">
            <button type="submit" class="button button-primary">
                <?php _e('Save Settings', 'prokip-ecommerce'); ?>
            </button>
        </p>
    </form>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Generate webhook secret
    window.generateWebhookSecret = function(platform) {
        var secret = generateRandomString(32);
        if (platform === 'woo') {
            $('#prokip_woo_webhook_secret').val(secret);
        } else if (platform === 'shopify') {
            $('#prokip_shopify_webhook_secret').val(secret);
        }
    };

    function generateRandomString(length) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var result = '';
        for (var i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Toggle sync interval based on auto sync setting
    $('#prokip_auto_sync_enabled').on('change', function() {
        var enabled = $(this).is(':checked');
        $('#prokip_sync_interval').prop('disabled', !enabled);
    });

    // Initialize state
    $('#prokip_sync_interval').prop('disabled', !$('#prokip_auto_sync_enabled').is(':checked'));
});
</script>

<style>
.prokip-settings-form {
    max-width: 800px;
}

.prokip-settings-section {
    background: #fff;
    border: 1px solid #ccd0d4;
    border-radius: 4px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.04);
}

.prokip-settings-section h2 {
    margin: 0 0 20px 0;
    font-size: 18px;
    color: #23282d;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
}

.prokip-settings-section code {
    background: #f1f1f1;
    padding: 5px;
    border-radius: 3px;
    font-family: monospace;
}
</style>
