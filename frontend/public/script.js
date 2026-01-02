let token = '';
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is already logged in
  const savedToken = localStorage.getItem('authToken');
  if (savedToken) {
    token = savedToken;
    showDashboard();
    // Check for OAuth callback
    handleOAuthCallback();
  } else {
    showLogin();
  }
});

// Handle OAuth callback from Shopify
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check for Shopify success
  if (urlParams.has('shopify_success')) {
    const store = urlParams.get('store');
    showNotification('success', `Successfully connected to Shopify store: ${store}`);
    // Clean URL
    window.history.replaceState({}, document.title, '/');
    // Refresh dashboard data
    loadDashboardData();
    loadConnectedStores();
  }
  
  // Check for Shopify error
  if (urlParams.has('shopify_error')) {
    const error = urlParams.get('shopify_error');
    showNotification('error', `Shopify connection failed: ${error}`);
    // Clean URL
    window.history.replaceState({}, document.title, '/');
  }
}

// Show notification to user
function showNotification(type, message) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('notification-fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// API call helper
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  if (response.status === 401) {
    logout();
    return;
  }

  return response;
}

// Authentication functions
async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!username || !password) {
    document.getElementById('login-error').textContent = 'Please enter both username and password';
    return;
  }

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('authToken', token);
      showDashboard();
    } else {
      document.getElementById('login-error').textContent = data.error || 'Login failed';
    }
  } catch (error) {
    document.getElementById('login-error').textContent = 'Network error. Please try again.';
  }
}

function logout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('authToken');
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  loadDashboardData();
}

// Navigation functions
function toggleProfileMenu() {
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function showModuleSettings() {
  document.getElementById('module-settings-modal').classList.add('show');
  document.getElementById('profile-dropdown').style.display = 'none';
  loadConnectedStores();
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('show');
  });
}

function connectShopify() {
  document.getElementById('module-settings-modal').classList.remove('show');
  document.getElementById('shopify-modal').classList.add('show');
}

function connectWooCommerce() {
  document.getElementById('module-settings-modal').classList.remove('show');
  document.getElementById('woocommerce-modal').classList.add('show');
}

// Connection functions
async function initiateShopifyConnection() {
  const storeUrl = document.getElementById('shopify-store-url').value.trim();

  if (!storeUrl) {
    alert('Please enter your Shopify store URL');
    return;
  }

  // Show loading state
  const modal = document.getElementById('shopify-modal');
  const originalContent = modal.querySelector('.modal-body').innerHTML;
  modal.querySelector('.modal-body').innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div class="loading-spinner"></div>
      <h3 style="margin-top: 20px; color: var(--gray-700);">Connecting to Shopify...</h3>
      <p style="color: var(--gray-500);">You will be redirected to Shopify to approve the connection.</p>
    </div>
  `;

  try {
    const res = await apiCall('/connections/shopify/initiate', {
      method: 'POST',
      body: JSON.stringify({ storeUrl })
    });

    if (res.ok) {
      const data = await res.json();
      // Redirect to Shopify OAuth
      window.location.href = data.authUrl;
    } else {
      const error = await res.json();
      // Restore original content
      modal.querySelector('.modal-body').innerHTML = originalContent;
      alert('Failed to initiate Shopify connection: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    // Restore original content
    modal.querySelector('.modal-body').innerHTML = originalContent;
    alert('Network error. Please try again.');
  }
}

async function connectWooCommerceStore() {
  const storeUrl = document.getElementById('woo-store-url').value.trim();
  const consumerKey = document.getElementById('woo-consumer-key').value.trim();
  const consumerSecret = document.getElementById('woo-consumer-secret').value.trim();

  if (!storeUrl || !consumerKey || !consumerSecret) {
    alert('Please fill in all WooCommerce connection details');
    return;
  }

  try {
    const res = await apiCall('/connections/woocommerce', {
      method: 'POST',
      body: JSON.stringify({
        storeUrl,
        consumerKey,
        consumerSecret
      })
    });

    if (res.ok) {
      alert('WooCommerce store connected successfully!');
      closeModal();
      loadConnectedStores();
      loadDashboardData();
    } else {
      const error = await res.json();
      alert('Failed to connect WooCommerce store: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

// Dashboard data loading
async function loadDashboardData() {
  try {
    const res = await apiCall('/sync/status');
    const data = await res.json();

    if (res.ok) {
      updateDashboardStats(data);
      updateActivityFeed(data);
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

function updateDashboardStats(data) {
  const totalStores = data.length;
  const totalProducts = data.reduce((sum, store) => sum + (store.productCount || 0), 0);
  const totalOrders = data.reduce((sum, store) => sum + (store.orderCount || 0), 0);

  document.getElementById('total-stores').textContent = totalStores;
  document.getElementById('total-products').textContent = totalProducts;
  document.getElementById('total-orders').textContent = totalOrders;
  document.getElementById('sync-status').textContent = 'Active';
}

function updateActivityFeed(data) {
  const activityList = document.getElementById('activity-list');
  const activities = [];

  data.forEach(store => {
    if (store.lastSync) {
      activities.push({
        message: `Synced ${store.platform} store: ${store.storeUrl}`,
        time: new Date(store.lastSync).toLocaleString(),
        icon: 'fas fa-sync'
      });
    }
  });

  if (activities.length === 0) {
    activities.push({
      message: 'Welcome to Prokip! Connect your first store to get started.',
      time: 'Just now',
      icon: 'fas fa-info-circle'
    });
  }

  activityList.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <div class="activity-icon">
        <i class="${activity.icon}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-message">${activity.message}</div>
        <div class="activity-time">${activity.time}</div>
      </div>
    </div>
  `).join('');
}

// Connected stores management
async function loadConnectedStores() {
  try {
    const res = await apiCall('/sync/status');
    const stores = await res.json();

    const storesList = document.getElementById('stores-list');
    storesList.innerHTML = '';

    if (stores.length === 0) {
      storesList.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No stores connected yet. Connect your first store above!</p>';
      return;
    }

    stores.forEach(store => {
      const storeItem = document.createElement('div');
      storeItem.className = 'store-item';

      const platform = store.platform.toLowerCase();
      const iconClass = platform === 'shopify' ? 'fab fa-shopify' : 'fas fa-shopping-cart';
      const iconBg = platform === 'shopify' ? '#96BF48' : '#96588A';

      storeItem.innerHTML = `
        <div class="store-info">
          <div class="store-icon" style="background: ${iconBg}; color: white;">
            <i class="${iconClass}"></i>
          </div>
          <div class="store-details">
            <h4>${store.platform.charAt(0).toUpperCase() + store.platform.slice(1)}</h4>
            <p>${store.storeUrl}</p>
          </div>
        </div>
        <div class="store-status status-active">Active</div>
        <div class="store-actions">
          <button class="btn-small btn-danger" onclick="disconnectStore(${store.id})">
            <i class="fas fa-trash"></i> Disconnect
          </button>
        </div>
      `;

      storesList.appendChild(storeItem);
    });
  } catch (error) {
    console.error('Failed to load connected stores:', error);
  }
}

async function disconnectStore(storeId) {
  if (!confirm('Are you sure you want to disconnect this store? This will stop all sync operations for this store.')) {
    return;
  }

  try {
    const res = await apiCall(`/connections/${storeId}`, { method: 'DELETE' });

    if (res.ok) {
      alert('Store disconnected successfully');
      loadConnectedStores();
      loadDashboardData();
    } else {
      const error = await res.json();
      alert('Failed to disconnect store: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

// Action functions
async function manualSync() {
  try {
    const res = await apiCall('/sync', { method: 'POST' });

    if (res.ok) {
      alert('Sync started successfully!');
      loadDashboardData();
    } else {
      const error = await res.json();
      alert('Failed to start sync: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const profileMenu = document.querySelector('.profile-menu');
  const dropdown = document.getElementById('profile-dropdown');

  if (!profileMenu.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});

// Close modals when clicking outside
document.addEventListener('click', function(event) {
  if (event.target.classList.contains('modal')) {
    closeModal();
  }
});

// Handle escape key for modals
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeModal();
  }
});
