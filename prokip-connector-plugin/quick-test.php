<?php
/**
 * Quick Test Script for Prokip E-commerce Integration
 * Run this script to verify everything is working
 */

echo "=== Prokip E-commerce Integration Quick Test ===\n\n";

// 1. Check if plugin files exist
echo "1. Checking plugin files...\n";
$required_files = [
    'prokip-ecommerce-sync.php',
    'includes/class-ecommerce-store.php',
    'includes/class-ecommerce-service.php',
    'includes/class-ecommerce-sync-controller.php',
    'includes/class-webhook-handler.php',
    'admin/pages/dashboard.php',
    'admin/pages/stores.php',
    'admin/pages/settings.php'
];

$missing_files = [];
foreach ($required_files as $file) {
    if (!file_exists($file)) {
        $missing_files[] = $file;
    }
}

if (empty($missing_files)) {
    echo "✓ All required plugin files are present\n";
} else {
    echo "✗ Missing files:\n";
    foreach ($missing_files as $file) {
        echo "  - $file\n";
    }
}

echo "\n";

// 2. Check PHP syntax
echo "2. Checking PHP syntax...\n";
$php_files = glob('**/*.php');
$syntax_errors = [];

foreach ($php_files as $file) {
    $output = [];
    $return_code = 0;
    exec("php -l \"$file\" 2>&1", $output, $return_code);
    
    if ($return_code !== 0) {
        $syntax_errors[$file] = implode("\n", $output);
    }
}

if (empty($syntax_errors)) {
    echo "✓ All PHP files have correct syntax\n";
} else {
    echo "✗ Syntax errors found:\n";
    foreach ($syntax_errors as $file => $error) {
        echo "  $file: $error\n";
    }
}

echo "\n";

// 3. Check WordPress integration (if WordPress is available)
echo "3. Checking WordPress integration...\n";

$wp_config = dirname(__FILE__, 3) . '/wp-config.php';
if (file_exists($wp_config)) {
    echo "✓ WordPress installation found\n";
    
    // Try to load WordPress
    try {
        require_once $wp_config;
        
        // Check if plugin can be loaded
        if (function_exists('add_action')) {
            echo "✓ WordPress functions available\n";
            
            // Check database tables (if plugin is activated)
            global $wpdb;
            if (isset($wpdb)) {
                $tables = $wpdb->get_results("SHOW TABLES LIKE '{$wpdb->prefix}prokip_%'");
                if (count($tables) > 0) {
                    echo "✓ Database tables found (" . count($tables) . " tables)\n";
                } else {
                    echo "⚠ Database tables not found (plugin may not be activated)\n";
                }
            }
        } else {
            echo "✗ WordPress functions not available\n";
        }
    } catch (Exception $e) {
        echo "✗ Error loading WordPress: " . $e->getMessage() . "\n";
    }
} else {
    echo "⚠ WordPress installation not found at expected location\n";
    echo "  Expected: " . $wp_config . "\n";
}

echo "\n";

// 4. Check file permissions
echo "4. Checking file permissions...\n";
$writable_files = [
    '.',
    'includes/',
    'admin/',
    'assets/'
];

$permission_issues = [];
foreach ($writable_files as $file) {
    if (!is_writable($file)) {
        $permission_issues[] = $file;
    }
}

if (empty($permission_issues)) {
    echo "✓ All directories are writable\n";
} else {
    echo "⚠ Permission issues (may need to fix):\n";
    foreach ($permission_issues as $file) {
        echo "  - $file is not writable\n";
    }
}

echo "\n";

// 5. Summary
echo "=== Test Summary ===\n";
if (empty($missing_files) && empty($syntax_errors)) {
    echo "🎉 Basic tests passed! The plugin files are ready.\n\n";
    echo "Next steps:\n";
    echo "1. Upload the prokip-connector-plugin folder to your WordPress site\n";
    echo "2. Go to WordPress Admin → Plugins → Activate 'Prokip E-commerce Integration'\n";
    echo "3. Configure Prokip API settings in Prokip E-commerce → Settings\n";
    echo "4. Connect your WooCommerce store in Prokip E-commerce → Store Connections\n";
    echo "5. Test the integration\n";
} else {
    echo "⚠️  Some issues found. Please fix them before proceeding.\n";
}

echo "\n";
echo "For detailed testing, run: php test-integration.php\n";
echo "For complete testing guide, see: TESTING_GUIDE.md\n";
?>
