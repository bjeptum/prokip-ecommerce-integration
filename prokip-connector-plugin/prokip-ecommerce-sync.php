<?php
/**
 * Plugin Name: Prokip E-commerce Integration
 * Plugin URI: https://prokip.africa
 * Description: Integrates WooCommerce with Prokip for bidirectional stock synchronization
 * Version: 1.0.0
 * Author: Prokip Team
 * License: MIT
 * Text Domain: prokip-ecommerce
 */

// Prevent direct file access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('PROKIP_ECOMMERCE_VERSION', '1.0.0');
define('PROKIP_ECOMMERCE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PROKIP_ECOMMERCE_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main plugin class
 */
class ProkipEcommerceIntegration
{
    private static $instance = null;

    public static function get_instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
        add_action('init', [$this, 'init']);
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_scripts']);
        
        // Activation hook
        register_activation_hook(__FILE__, [$this, 'activate']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate']);
    }

    public function init()
    {
        // Load textdomain
        load_plugin_textdomain('prokip-ecommerce', false, dirname(plugin_basename(__FILE__)) . '/languages');
        
        // Include required files
        $this->includes();
    }

    private function includes()
    {
        require_once PROKIP_ECOMMERCE_PLUGIN_DIR . 'includes/class-ecommerce-store.php';
        require_once PROKIP_ECOMMERCE_PLUGIN_DIR . 'includes/class-ecommerce-service.php';
        require_once PROKIP_ECOMMERCE_PLUGIN_DIR . 'includes/class-ecommerce-sync-controller.php';
        require_once PROKIP_ECOMMERCE_PLUGIN_DIR . 'includes/class-webhook-handler.php';
    }

    public function activate()
    {
        // Create database tables
        $this->create_database_tables();
        
        // Schedule cron jobs
        if (!wp_next_scheduled('prokip_stock_sync')) {
            wp_schedule_event(time(), 'hourly', 'prokip_stock_sync');
        }
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }

    public function deactivate()
    {
        // Clear scheduled cron jobs
        wp_clear_scheduled_hook('prokip_stock_sync');
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }

    private function create_database_tables()
    {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'prokip_ecommerce_stores';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
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
            KEY user_id (user_id),
            KEY platform (platform),
            UNIQUE KEY user_store (user_id, platform, store_url)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    public function register_rest_routes()
    {
        // Store connection endpoints
        register_rest_route('prokip-ecommerce/v1', '/connect-store', [
            'methods' => 'POST',
            'callback' => [$this, 'connect_store'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        register_rest_route('prokip-ecommerce/v1', '/disconnect-store/(?P<id>\d+)', [
            'methods' => 'DELETE',
            'callback' => [$this, 'disconnect_store'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        register_rest_route('prokip-ecommerce/v1', '/stores', [
            'methods' => 'GET',
            'callback' => [$this, 'get_stores'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        // Sync endpoints
        register_rest_route('prokip-ecommerce/v1', '/sync-products', [
            'methods' => 'POST',
            'callback' => [$this, 'sync_products'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        register_rest_route('prokip-ecommerce/v1', '/sync-orders', [
            'methods' => 'POST',
            'callback' => [$this, 'sync_orders'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        register_rest_route('prokip-ecommerce/v1', '/sync-inventory', [
            'methods' => 'POST',
            'callback' => [$this, 'sync_inventory'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        // Webhook endpoint
        register_rest_route('prokip-ecommerce/v1', '/webhook/(?P<platform>\w+)', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_webhook'],
            'permission_callback' => '__return_true'
        ]);
    }

    public function add_admin_menu()
    {
        add_menu_page(
            __('Prokip E-commerce', 'prokip-ecommerce'),
            __('Prokip E-commerce', 'prokip-ecommerce'),
            'manage_options',
            'prokip-ecommerce',
            [$this, 'admin_page'],
            'dashicons-sync',
            30
        );

        add_submenu_page(
            'prokip-ecommerce',
            __('Store Connections', 'prokip-ecommerce'),
            __('Store Connections', 'prokip-ecommerce'),
            'manage_options',
            'prokip-ecommerce-stores',
            [$this, 'stores_page']
        );

        add_submenu_page(
            'prokip-ecommerce',
            __('Sync Settings', 'prokip-ecommerce'),
            __('Sync Settings', 'prokip-ecommerce'),
            'manage_options',
            'prokip-ecommerce-settings',
            [$this, 'settings_page']
        );
    }

    public function enqueue_scripts()
    {
        wp_enqueue_script(
            'prokip-ecommerce-frontend',
            PROKIP_ECOMMERCE_PLUGIN_URL . 'assets/js/frontend.js',
            ['jquery'],
            PROKIP_ECOMMERCE_VERSION,
            true
        );

        wp_enqueue_style(
            'prokip-ecommerce-frontend',
            PROKIP_ECOMMERCE_PLUGIN_URL . 'assets/css/frontend.css',
            [],
            PROKIP_ECOMMERCE_VERSION
        );
    }

    public function enqueue_admin_scripts($hook)
    {
        if (strpos($hook, 'prokip-ecommerce') !== false) {
            wp_enqueue_script(
                'prokip-ecommerce-admin',
                PROKIP_ECOMMERCE_PLUGIN_URL . 'assets/js/admin.js',
                ['jquery', 'wp-api'],
                PROKIP_ECOMMERCE_VERSION,
                true
            );

            wp_enqueue_style(
                'prokip-ecommerce-admin',
                PROKIP_ECOMMERCE_PLUGIN_URL . 'assets/css/admin.css',
                [],
                PROKIP_ECOMMERCE_VERSION
            );
        }
    }

    // REST API callbacks will be implemented in the controller classes
    public function connect_store(WP_REST_Request $request)
    {
        $controller = new ProkipEcommerceSyncController();
        return $controller->connect_store($request);
    }

    public function disconnect_store(WP_REST_Request $request)
    {
        $controller = new ProkipEcommerceSyncController();
        return $controller->disconnect_store($request);
    }

    public function get_stores(WP_REST_Request $request)
    {
        $controller = new ProkipEcommerceSyncController();
        return $controller->get_stores($request);
    }

    public function sync_products(WP_REST_Request $request)
    {
        $controller = new ProkipEcommerceSyncController();
        return $controller->sync_products($request);
    }

    public function sync_orders(WP_REST_Request $request)
    {
        $controller = new ProkipEcommerceSyncController();
        return $controller->sync_orders($request);
    }

    public function sync_inventory(WP_REST_Request $request)
    {
        $controller = new ProkipEcommerceSyncController();
        return $controller->sync_inventory($request);
    }

    public function handle_webhook(WP_REST_Request $request)
    {
        $handler = new ProkipWebhookHandler();
        return $handler->handle($request);
    }

    public function admin_page()
    {
        include_once PROKIP_ECOMMERCE_PLUGIN_DIR . 'admin/pages/dashboard.php';
    }

    public function stores_page()
    {
        include_once PROKIP_ECOMMERCE_PLUGIN_DIR . 'admin/pages/stores.php';
    }

    public function settings_page()
    {
        include_once PROKIP_ECOMMERCE_PLUGIN_DIR . 'admin/pages/settings.php';
    }
}

// Initialize the plugin
ProkipEcommerceIntegration::get_instance();
