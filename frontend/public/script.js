let token = '';
let currentUser = null;
let currentBusinessLocation = null;
let businessLocations = [];
let prokipToken = null;
let selectedStore = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Check if returning from OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const hasOAuthParams = urlParams.has('shopify_success') || urlParams.has('shopify_error') || urlParams.has('code') || urlParams.has('shop');
  
  // If returning from OAuth, check for existing session
  if (hasOAuthParams) {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      token = savedToken;
      currentUser = { username: 'admin' }; // You might want to decode the JWT to get actual username
      handleOAuthCallback();
      showDashboard();
      return;
    }
  }
  
  // Otherwise, always show login screen initially (user requirement)
  // Remove auto-login even if token exists
  localStorage.removeItem('authToken');
  localStorage.removeItem('businessLocation');
  localStorage.removeItem('prokipToken');
  showLogin();
});

// Handle OAuth callback from Shopify
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check for Shopify success
  if (urlParams.has('shopify_success')) {
    const store = urlParams.get('store');
    const webhooks = urlParams.get('webhooks');
    
    let message = `Successfully connected to Shopify store: ${store}`;
    if (webhooks === 'success') {
      message += '\n✓ Webhooks registered successfully';
    } else if (webhooks === 'failed') {
      message += '\n⚠️ Webhook registration failed (this is optional)';
    }
    
    showNotification('success', message);
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
    // Clean URL and ensure we're on home page
    window.history.replaceState({}, document.title, '/');
    // Make sure user stays on dashboard
    if (token) {
      navigateTo('home');
    }
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

// Prokip API call helper
async function prokipApiCall(endpoint, options = {}) {
  if (!prokipToken) {
    showNotification('error', 'Please select a business location first');
    return;
  }

  const response = await fetch(`https://api.prokip.africa${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${prokipToken}`,
      ...options.headers
    }
  });

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
      currentUser = { username };
      localStorage.setItem('authToken', token);
      
      // Prokip API is configured on the backend
      // Just load business locations after successful login
      await loadBusinessLocations();
    } else {
      document.getElementById('login-error').textContent = data.error || 'Login failed';
    }
  } catch (error) {
    document.getElementById('login-error').textContent = 'Network error. Please try again.';
  }
}

// Load business locations (mock for now since not using actual Prokip API)
async function loadBusinessLocations() {
  // Mock business locations for development
  // In production, these would come from Prokip API
  businessLocations = [
    {
      id: 1,
      name: 'Main Store',
      city: 'Nairobi',
      state: 'Kenya',
      mobile: '+254 712 345 678'
    },
    {
      id: 2,
      name: 'Branch Store',
      city: 'Mombasa',
      state: 'Kenya',
      mobile: '+254 722 345 678'
    },
    {
      id: 3,
      name: 'Warehouse',
      city: 'Kisumu',
      state: 'Kenya',
      mobile: '+254 732 345 678'
    }
  ];
  
  showBusinessLocationSelection();
}

// Show business location selection screen
function showBusinessLocationSelection() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('location-selection-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';

  const locationsGrid = document.getElementById('locations-grid');
  locationsGrid.innerHTML = '';

  businessLocations.forEach(location => {
    const locationCard = document.createElement('div');
    locationCard.className = 'location-card';
    locationCard.onclick = () => selectBusinessLocation(location);

    locationCard.innerHTML = `
      <div class="location-icon">
        <i class="fas fa-building"></i>
      </div>
      <div class="location-info">
        <h3>${location.name}</h3>
        <p><i class="fas fa-map-marker-alt"></i> ${location.city || 'N/A'}, ${location.state || 'N/A'}</p>
        <p><i class="fas fa-phone"></i> ${location.mobile || 'No phone'}</p>
      </div>
      <div class="location-action">
        <i class="fas fa-arrow-right"></i>
      </div>
    `;

    locationsGrid.appendChild(locationCard);
  });
}

// Select a business location
function selectBusinessLocation(location) {
  currentBusinessLocation = location;
  localStorage.setItem('businessLocation', JSON.stringify(location));
  
  // Update profile display
  document.getElementById('profile-username').textContent = currentUser.username;
  document.getElementById('profile-location').textContent = location.name;

  showDashboard();
}

// Change business location
function changeBusinessLocation() {
  selectedStore = null;
  toggleProfileMenu();
  showBusinessLocationSelection();
}

function logout() {
  token = '';
  currentUser = null;
  currentBusinessLocation = null;
  prokipToken = null;
  selectedStore = null;
  businessLocations = [];
  
  localStorage.removeItem('authToken');
  localStorage.removeItem('businessLocation');
  localStorage.removeItem('prokipToken');
  
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('location-selection-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  
  // Clear form
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('login-error').textContent = '';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('location-selection-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  
  navigateTo('home');
  loadDashboardData();
  loadConnectedStores();
}

// Navigation functions
function navigateTo(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // Remove active class from all menu items
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.remove('active');
  });

  // Show selected page
  const pageElement = document.getElementById(`${pageName}-page`);
  if (pageElement) {
    pageElement.classList.add('active');
  }

  // Add active class to selected menu item
  const menuItem = document.querySelector(`[data-page="${pageName}"]`);
  if (menuItem) {
    menuItem.classList.add('active');
  }

  // Load page-specific data
  if (pageName === 'home') {
    loadDashboardData();
  } else if (pageName === 'settings') {
    loadConnectedStores();
  } else if (pageName.startsWith('store-')) {
    if (!selectedStore) {
      showNotification('error', 'Please select a store first');
      navigateTo('home');
      return;
    }
    loadStoreSpecificData(pageName);
  }
}

function toggleProfileMenu() {
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('show');
  });
}

function connectShopify() {
  document.getElementById('shopify-modal').classList.add('show');
}

function connectWooCommerce() {
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
      updateStoresOverview(data);
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

function updateStoresOverview(stores) {
  const grid = document.getElementById('stores-overview-grid');
  
  if (stores.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-store-slash"></i>
        <h3>No Stores Connected</h3>
        <p>Connect your first e-commerce store to get started</p>
        <button onclick="navigateTo('settings')" class="btn-primary">
          <i class="fas fa-plus"></i> Connect Store
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = stores.map(store => {
    const platform = store.platform.toLowerCase();
    const iconClass = platform === 'shopify' ? 'fab fa-shopify' : 'fas fa-shopping-cart';
    const iconBg = platform === 'shopify' ? '#96BF48' : '#96588A';

    return `
      <div class="store-overview-card" onclick="viewStore(${store.id}, '${store.platform}', '${store.storeUrl}')">
        <div class="store-overview-icon" style="background: ${iconBg};">
          <i class="${iconClass}"></i>
        </div>
        <div class="store-overview-info">
          <h3>${store.platform}</h3>
          <p>${store.storeUrl}</p>
        </div>
        <div class="store-overview-stats">
          <div class="stat-item">
            <span class="stat-value">${store.productCount || 0}</span>
            <span class="stat-label">Products</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${store.orderCount || 0}</span>
            <span class="stat-label">Orders</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function viewStore(storeId, platform, storeUrl) {
  console.log('viewStore called with:', { storeId, platform, storeUrl });
  selectedStore = { id: storeId, platform, storeUrl };
  
  // Show store menu section
  document.getElementById('store-menu-section').style.display = 'block';
  
  // Navigate to store products page
  navigateTo('store-products');
  
  // Update the page subtitle
  document.getElementById('store-products-subtitle').textContent = `${platform} - ${storeUrl}`;
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
      
      // If we disconnected the selected store, go back to home
      if (selectedStore && selectedStore.id === storeId) {
        selectedStore = null;
        document.getElementById('store-menu-section').style.display = 'none';
        navigateTo('home');
      }
    } else {
      const error = await res.json();
      alert('Failed to disconnect store: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

// Store-specific functions
function loadStoreSpecificData(pageName) {
  if (!selectedStore) return;

  const subtitle = document.getElementById(`${pageName}-subtitle`);
  if (subtitle) {
    subtitle.textContent = `${selectedStore.platform} - ${selectedStore.storeUrl}`;
  }

  if (pageName === 'store-products') {
    loadStoreProducts();
  } else if (pageName === 'store-orders') {
    loadStoreOrders();
  } else if (pageName === 'store-analytics') {
    loadStoreAnalytics();
  }
}

async function loadStoreProducts() {
  const content = document.getElementById('products-content');
  content.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center;">Loading products...</p>';

  try {
    // Fetch products directly from the store
    const res = await apiCall(`/stores/${selectedStore.id}/products`);
    if (res.ok) {
      const products = await res.json();
      displayProducts(products);
    } else {
      content.innerHTML = '<p style="text-align: center; color: var(--gray-500);">Failed to load products</p>';
    }
  } catch (error) {
    content.innerHTML = '<p style="text-align: center; color: var(--gray-500);">Error loading products</p>';
  }
}

function displayProducts(products) {
  const content = document.getElementById('products-content');
  
  if (products.length === 0) {
    content.innerHTML = '<p style="text-align: center; color: var(--gray-500);">No products found</p>';
    return;
  }

  content.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>SKU</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(product => `
            <tr>
              <td>${product.name || 'N/A'}</td>
              <td>${product.sku || 'N/A'}</td>
              <td>$${product.price || '0.00'}</td>
              <td>${product.stock || '0'}</td>
              <td><span class="status-badge ${product.synced ? 'status-success' : 'status-warning'}">${product.synced ? 'Synced' : 'Pending'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadStoreOrders() {
  const content = document.getElementById('orders-content');
  content.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center;">Loading orders...</p>';

  try {
    // Fetch orders directly from the store
    const res = await apiCall(`/stores/${selectedStore.id}/orders`);
    if (res.ok) {
      const orders = await res.json();
      displayOrders(orders);
    } else {
      content.innerHTML = '<p style="text-align: center; color: var(--gray-500);">Failed to load orders</p>';
    }
  } catch (error) {
    content.innerHTML = '<p style="text-align: center; color: var(--gray-500);">Error loading orders</p>';
  }
}

function displayOrders(orders) {
  const content = document.getElementById('orders-content');
  
  if (orders.length === 0) {
    content.innerHTML = '<p style="text-align: center; color: var(--gray-500);">No orders found</p>';
    return;
  }

  content.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td>${order.orderId || 'N/A'}</td>
              <td>${order.customer || 'N/A'}</td>
              <td>${order.date ? new Date(order.date).toLocaleDateString() : 'N/A'}</td>
              <td>$${order.total || '0.00'}</td>
              <td><span class="status-badge status-success">${order.status || 'Completed'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadStoreAnalytics() {
  try {
    // Get analytics from the store endpoint
    const res = await apiCall(`/stores/${selectedStore.id}/analytics`);
    if (res.ok) {
      const analytics = await res.json();
      document.getElementById('store-synced-products').textContent = analytics.syncedProducts || 0;
      document.getElementById('store-orders-processed').textContent = analytics.ordersProcessed || 0;
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
  }
}

async function syncStoreProducts() {
  console.log('syncStoreProducts called, selectedStore:', selectedStore);
  if (!selectedStore) {
    showNotification('error', 'Please select a store first');
    return;
  }

  const confirmed = confirm('Do you want to push products from Prokip to this store?\n\nThis will sync all Prokip products to your connected store.');
  if (!confirmed) return;

  try {
    showNotification('info', 'Starting product sync...');
    const res = await apiCall('/setup/products', {
      method: 'POST',
      body: JSON.stringify({
        method: 'push',
        connectionId: selectedStore.id
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      showNotification('success', data.message || 'Product sync completed successfully');
      setTimeout(() => loadStoreProducts(), 2000);
    } else {
      const error = await res.json();
      showNotification('error', error.error || 'Failed to sync products');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showNotification('error', 'Error starting product sync');
  }
}

async function syncStoreOrders() {
  console.log('syncStoreOrders called, selectedStore:', selectedStore);
  if (!selectedStore) {
    showNotification('error', 'Please select a store first');
    return;
  }

  if (selectedStore.platform === 'shopify') {
    showNotification('info', 'Shopify orders are synced automatically via webhooks');
    return;
  }

  const confirmed = confirm('Pull orders from your WooCommerce store?\n\nThis will fetch recent orders and sync them to Prokip.');
  if (!confirmed) return;

  try {
    showNotification('info', 'Pulling orders from store...');
    const res = await apiCall('/sync/pull-orders', { method: 'POST' });
    
    if (res.ok) {
      const data = await res.json();
      showNotification('success', data.message || 'Orders synced successfully');
      setTimeout(() => loadStoreOrders(), 2000);
    } else {
      const error = await res.json();
      showNotification('error', error.error || 'Failed to sync orders');
    }
  } catch (error) {
    console.error('Order sync error:', error);
    showNotification('error', 'Error syncing orders');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const profileMenu = document.querySelector('.profile-menu');
  const dropdown = document.getElementById('profile-dropdown');

  if (profileMenu && !profileMenu.contains(event.target)) {
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
