/**
 * Prokip E-commerce Integration - Frontend JavaScript
 */

jQuery(document).ready(function($) {
    // Initialize frontend functionality
    initProductSync();
    initStockDisplay();
    initRealTimeUpdates();
});

/**
 * Initialize product synchronization
 */
function initProductSync() {
    // Sync product data when page loads
    if ($('.prokip-product-data').length) {
        syncProductData();
    }
    
    // Handle manual sync requests
    $(document).on('click', '.prokip-sync-product', function(e) {
        e.preventDefault();
        var productId = $(this).data('product-id');
        syncSingleProduct(productId);
    });
}

/**
 * Initialize stock display
 */
function initStockDisplay() {
    // Update stock levels periodically
    if ($('.prokip-stock-level').length) {
        setInterval(updateStockLevels, 60000); // Update every minute
    }
    
    // Handle stock alerts
    $(document).on('click', '.prokip-stock-alert', function(e) {
        e.preventDefault();
        showStockAlert($(this).data('product-id'));
    });
}

/**
 * Initialize real-time updates
 */
function initRealTimeUpdates() {
    // WebSocket or long polling for real-time updates
    if (typeof prokipSettings !== 'undefined' && prokipSettings.enableRealTime) {
        startRealTimeUpdates();
    }
}

/**
 * Sync product data from Prokip
 */
function syncProductData() {
    var productIds = [];
    
    $('.prokip-product-data').each(function() {
        var productId = $(this).data('product-id');
        if (productId) {
            productIds.push(productId);
        }
    });
    
    if (productIds.length === 0) {
        return;
    }
    
    $.ajax({
        url: prokipSettings.apiEndpoint + '/products/sync',
        method: 'POST',
        data: {
            product_ids: productIds
        },
        beforeSend: function(xhr) {
            xhr.setRequestHeader('X-WP-Nonce', prokipSettings.nonce);
        },
        success: function(response) {
            if (response.success) {
                updateProductDisplay(response.products);
            }
        },
        error: function(xhr) {
            console.error('Product sync failed:', xhr.responseText);
        }
    });
}

/**
 * Sync a single product
 */
function syncSingleProduct(productId) {
    var $button = $('.prokip-sync-product[data-product-id="' + productId + '"]');
    var originalText = $button.text();
    
    $button.text('Syncing...').prop('disabled', true);
    
    $.ajax({
        url: prokipSettings.apiEndpoint + '/products/' + productId + '/sync',
        method: 'POST',
        beforeSend: function(xhr) {
            xhr.setRequestHeader('X-WP-Nonce', prokipSettings.nonce);
        },
        success: function(response) {
            if (response.success) {
                updateSingleProductDisplay(productId, response.product);
                showNotification('Product synchronized successfully', 'success');
            } else {
                showNotification(response.message || 'Sync failed', 'error');
            }
        },
        error: function(xhr) {
            showNotification('Network error occurred', 'error');
        },
        complete: function() {
            $button.text(originalText).prop('disabled', false);
        }
    });
}

/**
 * Update product display with synced data
 */
function updateProductDisplay(products) {
    products.forEach(function(product) {
        updateSingleProductDisplay(product.id, product);
    });
}

/**
 * Update single product display
 */
function updateSingleProductDisplay(productId, product) {
    var $productData = $('.prokip-product-data[data-product-id="' + productId + '"]');
    
    if ($productData.length) {
        // Update stock level
        if (product.stock_quantity !== undefined) {
            var $stockLevel = $productData.find('.prokip-stock-level');
            $stockLevel.text(product.stock_quantity);
            
            // Add stock status class
            $stockLevel.removeClass('in-stock low-stock out-of-stock');
            if (product.stock_quantity > 10) {
                $stockLevel.addClass('in-stock');
            } else if (product.stock_quantity > 0) {
                $stockLevel.addClass('low-stock');
            } else {
                $stockLevel.addClass('out-of-stock');
            }
        }
        
        // Update price
        if (product.price !== undefined) {
            var $price = $productData.find('.prokip-price');
            $price.text(formatPrice(product.price));
        }
        
        // Update last sync time
        if (product.last_sync) {
            var $syncTime = $productData.find('.prokip-last-sync');
            $syncTime.text('Last sync: ' + formatDateTime(product.last_sync));
        }
    }
}

/**
 * Update stock levels
 */
function updateStockLevels() {
    var productIds = [];
    
    $('.prokip-stock-level').each(function() {
        var productId = $(this).closest('.prokip-product-data').data('product-id');
        if (productId) {
            productIds.push(productId);
        }
    });
    
    if (productIds.length === 0) {
        return;
    }
    
    $.ajax({
        url: prokipSettings.apiEndpoint + '/stock/check',
        method: 'POST',
        data: {
            product_ids: productIds
        },
        beforeSend: function(xhr) {
            xhr.setRequestHeader('X-WP-Nonce', prokipSettings.nonce);
        },
        success: function(response) {
            if (response.success) {
                response.stock_levels.forEach(function(stock) {
                    updateStockLevel(stock.product_id, stock.quantity);
                });
            }
        },
        error: function(xhr) {
            console.error('Stock level update failed:', xhr.responseText);
        }
    });
}

/**
 * Update stock level for a product
 */
function updateStockLevel(productId, quantity) {
    var $stockLevel = $('.prokip-product-data[data-product-id="' + productId + '"] .prokip-stock-level');
    
    if ($stockLevel.length) {
        $stockLevel.text(quantity);
        
        // Update status classes
        $stockLevel.removeClass('in-stock low-stock out-of-stock');
        if (quantity > 10) {
            $stockLevel.addClass('in-stock');
        } else if (quantity > 0) {
            $stockLevel.addClass('low-stock');
        } else {
            $stockLevel.addClass('out-of-stock');
        }
    }
}

/**
 * Show stock alert
 */
function showStockAlert(productId) {
    var $productData = $('.prokip-product-data[data-product-id="' + productId + '"]');
    var productName = $productData.find('.prokip-product-name').text();
    var stockLevel = $productData.find('.prokip-stock-level').text();
    
    var message = 'Product: ' + productName + '\nCurrent Stock: ' + stockLevel + '\n\nWould you like to restock this item?';
    
    if (confirm(message)) {
        // Redirect to restock page or open modal
        window.location.href = prokipSettings.adminUrl + '/admin.php?page=prokip-restock&product_id=' + productId;
    }
}

/**
 * Start real-time updates
 */
function startRealTimeUpdates() {
    // Use WebSocket if available, otherwise fall back to polling
    if (typeof WebSocket !== 'undefined' && prokipSettings.websocketUrl) {
        connectWebSocket();
    } else {
        // Fallback to polling
        setInterval(function() {
            pollForUpdates();
        }, 30000); // Poll every 30 seconds
    }
}

/**
 * Connect to WebSocket for real-time updates
 */
function connectWebSocket() {
    var socket = new WebSocket(prokipSettings.websocketUrl);
    
    socket.onopen = function() {
        console.log('Prokip WebSocket connected');
        
        // Subscribe to updates
        socket.send(JSON.stringify({
            action: 'subscribe',
            data: {
                store_id: prokipSettings.storeId,
                events: ['stock_update', 'product_update', 'order_update']
            }
        }));
    };
    
    socket.onmessage = function(event) {
        var data = JSON.parse(event.data);
        handleRealTimeUpdate(data);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
    
    socket.onclose = function() {
        console.log('WebSocket closed, attempting to reconnect...');
        setTimeout(connectWebSocket, 5000);
    };
}

/**
 * Handle real-time update
 */
function handleRealTimeUpdate(data) {
    switch (data.event) {
        case 'stock_update':
            updateStockLevel(data.product_id, data.quantity);
            showNotification('Stock updated for product ' + data.product_id, 'info');
            break;
            
        case 'product_update':
            updateSingleProductDisplay(data.product_id, data.product);
            showNotification('Product updated', 'info');
            break;
            
        case 'order_update':
            // Refresh stock levels after order
            updateStockLevels();
            showNotification('New order received', 'info');
            break;
    }
}

/**
 * Poll for updates (fallback method)
 */
function pollForUpdates() {
    $.ajax({
        url: prokipSettings.apiEndpoint + '/updates',
        method: 'GET',
        beforeSend: function(xhr) {
            xhr.setRequestHeader('X-WP-Nonce', prokipSettings.nonce);
        },
        success: function(response) {
            if (response.success && response.updates) {
                response.updates.forEach(function(update) {
                    handleRealTimeUpdate(update);
                });
            }
        },
        error: function(xhr) {
            console.error('Polling failed:', xhr.responseText);
        }
    });
}

/**
 * Show notification
 */
function showNotification(message, type) {
    type = type || 'info';
    
    var notification = $('<div class="prokip-notification prokip-' + type + '">' + message + '</div>');
    
    $('body').append(notification);
    
    // Position notification
    notification.css({
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'error' ? '#dc3232' : (type === 'success' ? '#46b450' : '#0073aa'),
        color: 'white',
        padding: '10px 15px',
        borderRadius: '4px',
        zIndex: 999999,
        fontSize: '14px',
        maxWidth: '300px'
    });
    
    // Auto-hide after 5 seconds
    setTimeout(function() {
        notification.fadeOut(500, function() {
            $(this).remove();
        });
    }, 5000);
}

/**
 * Format price
 */
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
}

/**
 * Format date/time
 */
function formatDateTime(dateString) {
    var date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Export functions to global scope
 */
window.ProkipFrontend = {
    syncProductData: syncProductData,
    syncSingleProduct: syncSingleProduct,
    updateStockLevels: updateStockLevels,
    showNotification: showNotification,
    formatPrice: formatPrice,
    formatDateTime: formatDateTime
};
