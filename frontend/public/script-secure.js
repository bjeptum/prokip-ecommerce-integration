// Add these functions to your existing script.js or replace the WooCommerce functions

// Test WooCommerce connection
async function testWooCommerceConnection() {
  const storeUrl = document.getElementById('woo-store-url').value.trim();
  const consumerKey = document.getElementById('woo-consumer-key').value.trim();
  const consumerSecret = document.getElementById('woo-consumer-secret').value.trim();

  if (!storeUrl || !consumerKey || !consumerSecret) {
    showWooConnectionStatus('error', 'Please fill in all required fields');
    return;
  }

  // Show loading state
  const testBtn = document.getElementById('test-woo-btn');
  const originalText = testBtn.innerHTML;
  testBtn.disabled = true;
  testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
  showWooConnectionStatus('info', 'Testing connection...');

  try {
    const response = await apiCall('/woo-connections/test', 'POST', {
      storeUrl,
      consumerKey,
      consumerSecret
    });

    if (response.success) {
      showWooConnectionStatus('success', 
        `✅ Connection successful! Store: ${response.storeInfo.url}, Products accessible: ${response.testResults.productsFetched}`
      );
    } else {
      showWooConnectionStatus('error', response.message, response.details, response.suggestions);
    }
  } catch (error) {
    console.error('WooCommerce test error:', error);
    showWooConnectionStatus('error', 'Connection test failed', error.message);
  } finally {
    testBtn.disabled = false;
    testBtn.innerHTML = originalText;
  }
}

// Connect WooCommerce store
async function connectWooCommerceStore() {
  const storeUrl = document.getElementById('woo-store-url').value.trim();
  const consumerKey = document.getElementById('woo-consumer-key').value.trim();
  const consumerSecret = document.getElementById('woo-consumer-secret').value.trim();
  const storeName = document.getElementById('woo-store-name').value.trim();

  if (!storeUrl || !consumerKey || !consumerSecret) {
    showWooConnectionStatus('error', 'Please fill in all required fields');
    return;
  }

  // Show loading state
  const connectBtn = document.getElementById('connect-woo-btn');
  const originalText = connectBtn.innerHTML;
  connectBtn.disabled = true;
  connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
  showWooConnectionStatus('info', 'Connecting your store...');

  try {
    const response = await apiCall('/woo-connections/connect', 'POST', {
      storeUrl,
      consumerKey,
      consumerSecret,
      storeName
    });

    if (response.success) {
      showWooConnectionStatus('success', 
        `✅ Store connected successfully! Store: ${response.connection.storeName}`
      );
      
      setTimeout(() => {
        closeModal();
        loadConnectedStores();
        loadDashboardData();
      }, 2000);
    } else {
      showWooConnectionStatus('error', response.message, response.details, response.suggestions);
    }
  } catch (error) {
    console.error('WooCommerce connection error:', error);
    showWooConnectionStatus('error', 'Connection failed', error.message);
  } finally {
    connectBtn.disabled = false;
    connectBtn.innerHTML = originalText;
  }
}

// Show WooCommerce connection status
function showWooConnectionStatus(type, message, details = null, suggestions = null) {
  const statusDiv = document.getElementById('woo-connection-status');
  statusDiv.style.display = 'block';
  
  let html = '<div class="alert alert-' + type + '">' + message + '</div>';
  
  if (details) {
    html += '<div class="error-details"><strong>Details:</strong> ' + details + '</div>';
  }
  
  if (suggestions && suggestions.length > 0) {
    html += '<div class="suggestions"><strong>Suggestions:</strong><ul>';
    suggestions.forEach(function(suggestion) {
      html += '<li>' + suggestion + '</li>';
    });
    html += '</ul></div>';
  }
  
  statusDiv.innerHTML = html;
}

// Auto-format URL
document.addEventListener('DOMContentLoaded', function() {
  const storeUrlInput = document.getElementById('woo-store-url');
  if (storeUrlInput) {
    storeUrlInput.addEventListener('blur', function() {
      const url = this.value;
      if (url && !url.startsWith('http')) {
        this.value = 'https://' + url;
      }
    });
  }
});
