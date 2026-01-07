let token = '';
let currentUser = null;
let currentBusinessLocation = null;
let businessLocations = [];
let prokipToken = null;
let selectedStore = null;
let selectedConnectionId = null;
let productMatchesData = null;
let productReadinessData = null;

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
  
  // Convert \n to <br> for proper line breaks
  const formattedMessage = message.replace(/\n/g, '<br>');
  
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      </div>
      <div class="notification-message">${formattedMessage}</div>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 6 seconds
  setTimeout(() => {
    notification.classList.add('notification-fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 6000);
}

// API call helper
async function apiCall(endpoint, methodOrOptions = 'GET', data = null) {
  console.log('apiCall:', endpoint, methodOrOptions, data);

  let method = 'GET';
  let options = {};

  if (typeof methodOrOptions === 'string') {
    method = methodOrOptions;
    options = data ? { body: JSON.stringify(data) } : {};
  } else {
    options = methodOrOptions;
    method = options.method || 'GET';
  }

  console.log('token:', token ? 'present' : 'missing');

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(endpoint, config);
    console.log('Response status:', response.status);

    if (response.status === 401) {
      console.error('Authentication failed');
      logout();
      return;
    }

    const responseData = await response.json();
    console.log('Response data:', responseData);

    if (!response.ok) {
      throw new Error(responseData.error || `HTTP ${response.status}`);
    }

    return responseData;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
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
  } else if (pageName === 'prokip-operations') {
    loadProkipProducts();
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
    modal.style.display = 'none';
  });
}

function connectShopify() {
  document.getElementById('shopify-modal').classList.add('show');
  document.getElementById('shopify-modal').style.display = 'flex';
}

function connectWooCommerce() {
  document.getElementById('woocommerce-modal').classList.add('show');
  document.getElementById('woocommerce-modal').style.display = 'flex';
}

// Connection functions
async function initiateShopifyConnection() {
  const storeUrl = document.getElementById('shopify-store-url').value.trim();

  if (!storeUrl) {
    showNotification('error', 'Please enter your Shopify store URL');
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
    const data = await apiCall('/connections/shopify/initiate', 'POST', { storeUrl });
    
    // Redirect to Shopify OAuth
    if (data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      throw new Error('No authorization URL received');
    }
  } catch (error) {
    console.error('Shopify connection error:', error);
    // Restore original content
    modal.querySelector('.modal-body').innerHTML = originalContent;
    showNotification('error', 'Failed to initiate Shopify connection: ' + (error.message || 'Unknown error'));
  }
}

async function connectWooCommerceStore() {
  const storeUrl = document.getElementById('woo-store-url').value.trim();
  const consumerKey = document.getElementById('woo-consumer-key').value.trim();
  const consumerSecret = document.getElementById('woo-consumer-secret').value.trim();

  if (!storeUrl || !consumerKey || !consumerSecret) {
    showNotification('error', 'Please fill in all WooCommerce connection details');
    return;
  }

  try {
    await apiCall('/connections/woocommerce', 'POST', {
      storeUrl,
      consumerKey,
      consumerSecret
    });

    showNotification('success', 'WooCommerce store connected successfully!');
    closeModal();
    loadConnectedStores();
    loadDashboardData();
  } catch (error) {
    console.error('WooCommerce connection error:', error);
    showNotification('error', 'Failed to connect WooCommerce store: ' + (error.message || 'Unknown error'));
  }
}

// Dashboard data loading
async function loadDashboardData() {
  try {
    const data = await apiCall('/sync/status');
    updateDashboardStats(data);
    updateStoresOverview(data.stores || data);
    updateActivityFeed(data);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

function updateDashboardStats(data) {
  const stores = data.stores || data;
  const prokip = data.prokip || { products: 0, sales: 0, purchases: 0 };

  const totalStores = stores.length;
  const totalProducts = stores.reduce((sum, store) => sum + (store.productCount || 0), 0) + prokip.products;
  const totalOrders = stores.reduce((sum, store) => sum + (store.orderCount || 0), 0) + prokip.sales + prokip.purchases;

  document.getElementById('total-stores').textContent = totalStores;
  document.getElementById('total-products').textContent = totalProducts;
  document.getElementById('total-orders').textContent = totalOrders;
  document.getElementById('sync-status').textContent = 'Active';

  // Update Prokip-specific stats
  document.getElementById('prokip-products').textContent = prokip.products;
  document.getElementById('prokip-sales').textContent = prokip.sales;
  document.getElementById('prokip-purchases').textContent = prokip.purchases;
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
      <div class="store-overview-card">
        <div class="store-overview-header" onclick="viewStore(${store.id}, '${store.platform}', '${store.storeUrl}')">
          <div class="store-overview-icon" style="background: ${iconBg};">
            <i class="${iconClass}"></i>
          </div>
          <div class="store-overview-info">
            <h3>${store.platform}</h3>
            <p>${store.storeUrl}</p>
          </div>
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
        <div class="store-overview-actions">
          <button onclick="showProductSetupFlow(${store.id}, '${store.platform}', '${store.storeUrl}')" class="btn-small btn-primary">
            <i class="fas fa-sync-alt"></i> Setup Products
          </button>
          <button onclick="viewStore(${store.id}, '${store.platform}', '${store.storeUrl}')" class="btn-small btn-secondary">
            <i class="fas fa-eye"></i> View Details
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function viewStore(storeId, platform, storeUrl) {
  console.log('viewStore called with:', { storeId, platform, storeUrl });
  selectedStore = { id: storeId, platform, storeUrl };
  selectedConnectionId = storeId;
  
  // Show store menu section
  document.getElementById('store-menu-section').style.display = 'block';
  
  // Navigate to store products page
  navigateTo('store-products');
  
  // Update the page subtitle
  document.getElementById('store-products-subtitle').textContent = `${platform} - ${storeUrl}`;
}

// Product Setup Flow Functions

function showProductSetupFlow(connectionId, platform, storeUrl) {
  selectedConnectionId = connectionId;
  selectedStore = { id: connectionId, platform, storeUrl };
  
  // Show product source selection modal
  document.getElementById('product-source-modal').style.display = 'flex';
}

async function selectProductSource(method) {
  if (!selectedConnectionId) {
    showNotification('error', 'Please select a store first');
    return;
  }

  closeModal();
  
  if (method === 'pull') {
    // Show loading
    showNotification('info', 'Loading product matches...');
    
    try {
      productMatchesData = await apiCall(`/setup/products/matches?connectionId=${selectedConnectionId}`);
      displayProductMatches();
    } catch (error) {
      console.error('Failed to load matches:', error);
      showNotification('error', 'Error loading product matches');
    }
  } else if (method === 'push') {
    // Show loading
    showNotification('info', 'Checking product readiness...');
    
    try {
      productReadinessData = await apiCall('/setup/products/readiness-check', 'POST', { connectionId: selectedConnectionId });
      displayProductReadiness();
    } catch (error) {
      console.error('Failed readiness check:', error);
      showNotification('error', 'Error checking product readiness');
    }
  }
}

function displayProductMatches() {
  const modal = document.getElementById('product-matching-modal');
  const summary = document.getElementById('matching-summary');
  const content = document.getElementById('matching-content');
  
  const matchedCount = productMatchesData.matches.length;
  const unmatchedProkipCount = productMatchesData.unmatched.prokip.length;
  const unmatchedStoreCount = productMatchesData.unmatched.store.length;
  
  // Update counts
  document.getElementById('matched-count').textContent = matchedCount;
  document.getElementById('unmatched-prokip-count').textContent = unmatchedProkipCount;
  document.getElementById('unmatched-store-count').textContent = unmatchedStoreCount;
  
  // Summary
  summary.innerHTML = `
    <div class="summary-card">
      <i class="fas fa-check-circle" style="color: var(--success);"></i>
      <div>
        <h3>${matchedCount} products matched by SKU</h3>
        <p>These products will be synced automatically</p>
      </div>
    </div>
    ${unmatchedProkipCount > 0 ? `
      <div class="summary-card warning">
        <i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i>
        <div>
          <h3>${unmatchedProkipCount} Prokip products not found in store</h3>
          <p>These will be created in your store during pull</p>
        </div>
      </div>
    ` : ''}
    ${unmatchedStoreCount > 0 ? `
      <div class="summary-card info">
        <i class="fas fa-info-circle" style="color: var(--info);"></i>
        <div>
          <h3>${unmatchedStoreCount} store products not in Prokip</h3>
          <p>These will be created in Prokip during pull</p>
        </div>
      </div>
    ` : ''}
  `;
  
  // Show matched products by default
  showMatchingTab('matched');
  
  modal.style.display = 'flex';
}

function showMatchingTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  const content = document.getElementById('matching-content');
  
  if (tab === 'matched') {
    content.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Prokip Product</th>
              <th>Store Product</th>
              <th>Price Match</th>
            </tr>
          </thead>
          <tbody>
            ${productMatchesData.matches.map(match => {
              const priceMatch = Math.abs(parseFloat(match.prokipProduct.price) - parseFloat(match.storeProduct.price)) < 0.01;
              return `
                <tr>
                  <td><code>${match.sku}</code></td>
                  <td>${match.prokipProduct.name}</td>
                  <td>${match.storeProduct.name}</td>
                  <td>
                    <span class="badge ${priceMatch ? 'badge-success' : 'badge-warning'}">
                      ${priceMatch ? '✓ Match' : '⚠ Different'}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (tab === 'unmatched-prokip') {
    content.innerHTML = `
      <p class="info-text">These Prokip products don't exist in your store yet. They will be created during the pull process.</p>
      <ul class="product-list">
        ${productMatchesData.unmatched.prokip.map(p => `
          <li><strong>${p.name}</strong> <code>${p.sku}</code></li>
        `).join('')}
      </ul>
    `;
  } else if (tab === 'unmatched-store') {
    content.innerHTML = `
      <p class="info-text">These store products don't exist in Prokip yet. They will be created during the pull process.</p>
      <ul class="product-list">
        ${productMatchesData.unmatched.store.map(p => `
          <li><strong>${p.name}</strong> <code>${p.sku}</code></li>
        `).join('')}
      </ul>
    `;
  }
}

async function confirmMatches() {
  closeModal();
  showNotification('info', 'Starting product pull...');
  
  try {
    const res = await apiCall('/setup/products', {
      method: 'POST',
      body: JSON.stringify({
        method: 'pull',
        connectionId: selectedConnectionId
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      showNotification('success', data.message || 'Products pulled successfully');
      setTimeout(() => loadDashboardData(), 2000);
    } else {
      const error = await res.json();
      showNotification('error', error.error || 'Failed to pull products');
    }
  } catch (error) {
    console.error('Pull error:', error);
    showNotification('error', 'Error pulling products');
  }
}

function displayProductReadiness() {
  const modal = document.getElementById('product-readiness-modal');
  const summary = document.getElementById('readiness-summary');
  const productsDiv = document.getElementById('readiness-products');
  const publishBtn = document.getElementById('publish-btn');
  
  const { total, ready, needsAttention } = productReadinessData.summary;
  
  // Summary
  summary.innerHTML = `
    <div class="readiness-stats">
      <div class="stat-item success">
        <div class="stat-number">${ready}</div>
        <div class="stat-label">Ready to Publish</div>
      </div>
      <div class="stat-item ${needsAttention > 0 ? 'warning' : 'muted'}">
        <div class="stat-number">${needsAttention}</div>
        <div class="stat-label">Needs Attention</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total Products</div>
      </div>
    </div>
  `;
  
  // Products list
  productsDiv.innerHTML = productReadinessData.products.map(product => {
    const hasIssues = product.issues.length > 0;
    return `
      <div class="readiness-product ${hasIssues ? 'has-issues' : 'ready'}">
        <div class="product-header">
          <div>
            <i class="fas fa-${hasIssues ? 'exclamation-circle' : 'check-circle'}"></i>
            <strong>${product.name || 'Unnamed Product'}</strong>
            <code>${product.sku || 'No SKU'}</code>
          </div>
          <span class="badge ${hasIssues ? 'badge-warning' : 'badge-success'}">
            ${hasIssues ? 'Needs Attention' : 'Ready'}
          </span>
        </div>
        ${hasIssues ? `
          <div class="product-issues">
            <strong>Issues:</strong>
            <ul>
              ${product.issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
            <p class="help-text"><i class="fas fa-info-circle"></i> Please fix these issues in Prokip before publishing</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Enable/disable publish button
  publishBtn.disabled = needsAttention > 0;
  if (needsAttention > 0) {
    publishBtn.innerHTML = '<i class="fas fa-ban"></i> Fix Issues First';
  } else {
    publishBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish to Store';
  }
  
  modal.style.display = 'flex';
}

async function publishProducts() {
  closeModal();
  showNotification('info', 'Publishing products to store...');
  
  try {
    const res = await apiCall('/setup/products', {
      method: 'POST',
      body: JSON.stringify({
        method: 'push',
        connectionId: selectedConnectionId
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      showNotification('success', data.message || 'Products published successfully');
      setTimeout(() => loadDashboardData(), 2000);
    } else {
      const error = await res.json();
      showNotification('error', error.error || 'Failed to publish products');
    }
  } catch (error) {
    console.error('Publish error:', error);
    showNotification('error', 'Error publishing products');
  }
}

// Sync Errors Management
async function showSyncErrors(connectionId = null) {
  try {
    const url = connectionId ? `/sync/errors?connectionId=${connectionId}` : '/sync/errors';
    const res = await apiCall(url);
    
    if (res.ok) {
      const errors = await res.json();
      displaySyncErrors(errors);
    } else {
      showNotification('error', 'Failed to load sync errors');
    }
  } catch (error) {
    console.error('Failed to load errors:', error);
    showNotification('error', 'Error loading sync errors');
  }
}

function displaySyncErrors(errors) {
  const modal = document.getElementById('sync-errors-modal');
  const errorsList = document.getElementById('errors-list');
  
  if (errors.length === 0) {
    errorsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="color: var(--success); font-size: 48px;"></i>
        <h3>No Sync Errors</h3>
        <p>All syncs are running smoothly!</p>
      </div>
    `;
  } else {
    errorsList.innerHTML = errors.map(error => `
      <div class="error-item ${error.resolved ? 'resolved' : 'unresolved'}">
        <div class="error-header">
          <div>
            <span class="error-type">${error.errorType.replace(/_/g, ' ').toUpperCase()}</span>
            <span class="error-store">${error.connection.platform} - ${error.connection.storeUrl}</span>
          </div>
          <span class="error-date">${new Date(error.createdAt).toLocaleString()}</span>
        </div>
        <div class="error-message">${error.errorMessage}</div>
        ${error.orderId ? `<div class="error-order">Order ID: <code>${error.orderId}</code></div>` : ''}
        ${!error.resolved ? `
          <button onclick="resolveError(${error.id})" class="btn-small btn-primary">
            <i class="fas fa-check"></i> Mark Resolved
          </button>
        ` : '<span class="resolved-badge"><i class="fas fa-check-circle"></i> Resolved</span>'}
      </div>
    `).join('');
  }
  
  modal.style.display = 'flex';
}

async function resolveError(errorId) {
  try {
    await apiCall(`/sync/errors/${errorId}/resolve`, 'PATCH');
    showNotification('success', 'Error marked as resolved');
    // Reload errors
    showSyncErrors();
  } catch (error) {
    console.error('Failed to resolve error:', error);
    showNotification('error', 'Error resolving sync error');
  }
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
    await apiCall(`/connections/${storeId}`, 'DELETE');
    showNotification('success', 'Store disconnected successfully');
    loadConnectedStores();
    loadDashboardData();
    
    // If we disconnected the selected store, go back to home
    if (selectedStore && selectedStore.id === storeId) {
      selectedStore = null;
      document.getElementById('store-menu-section').style.display = 'none';
      navigateTo('home');
    }
  } catch (error) {
    console.error('Disconnect error:', error);
    showNotification('error', 'Failed to disconnect store: ' + (error.message || 'Unknown error'));
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
    const products = await apiCall(`/stores/${selectedStore.id}/products`);
    displayProducts(products);
  } catch (error) {
    console.error('Failed to load products:', error);
    
    // Check if it's an authentication error
    if (error.message && (error.message.includes('authentication') || error.message.includes('Invalid API key'))) {
      content.innerHTML = `
        <div class="empty-state-card" style="border-color: var(--warning-color);">
          <div class="empty-state-icon" style="color: var(--warning-color);">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3>Authentication Error</h3>
          <p>Your ${selectedStore.platform} store connection has expired or is invalid.</p>
          <p style="margin-top: 10px;">Please disconnect and reconnect this store from Settings.</p>
          <button onclick="navigateTo('settings')" class="btn-primary" style="margin-top: 20px;">
            <i class="fas fa-cog"></i> Go to Settings
          </button>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h3>Error Loading Products</h3>
          <p>${error.message || 'Failed to load products from store'}</p>
        </div>
      `;
    }
  }
}

function displayProducts(products) {
  const content = document.getElementById('products-content');
  
  if (products.length === 0) {
    content.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">
          <i class="fas fa-box-open"></i>
        </div>
        <h3>No Products Found</h3>
        <p>This store doesn't have any products yet. Click "Sync Products" to push products from Prokip.</p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="content-card">
      <div class="card-header">
        <h3><i class="fas fa-box"></i> Product Catalog</h3>
        <span class="badge">${products.length} ${products.length === 1 ? 'Product' : 'Products'}</span>
      </div>
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
                <td>
                  <div class="product-cell">
                    <div class="product-icon"><i class="fas fa-cube"></i></div>
                    <strong>${product.name || product.title || 'Untitled Product'}</strong>
                  </div>
                </td>
                <td><code class="sku-code">${product.sku || 'N/A'}</code></td>
                <td><strong class="price-text">$${parseFloat(product.price || 0).toFixed(2)}</strong></td>
                <td><span class="stock-badge ${(product.stock || 0) > 0 ? 'stock-in' : 'stock-out'}">${product.stock || 0} units</span></td>
                <td><span class="status-badge ${product.synced ? 'status-success' : 'status-warning'}">${product.synced ? 'Synced' : 'Pending'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
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
    content.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">
          <i class="fas fa-receipt"></i>
        </div>
        <h3>No Orders Found</h3>
        <p>This store doesn't have any orders yet. Orders will appear here automatically via webhooks.</p>
      </div>
    `;
    return;
  }

  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);

  content.innerHTML = `
    <div class="content-card">
      <div class="card-header">
        <h3><i class="fas fa-shopping-cart"></i> Order History</h3>
        <div class="header-stats">
          <span class="badge">${orders.length} ${orders.length === 1 ? 'Order' : 'Orders'}</span>
          <span class="revenue-badge">Total: $${totalRevenue.toFixed(2)}</span>
        </div>
      </div>
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
                <td><code class="order-id">#${order.orderId || order.id || 'N/A'}</code></td>
                <td>
                  <div class="customer-cell">
                    <i class="fas fa-user-circle"></i>
                    <span>${order.customer || order.customer_name || 'Guest'}</span>
                  </div>
                </td>
                <td>${order.date || order.created_at ? new Date(order.date || order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</td>
                <td><strong class="price-text">$${parseFloat(order.total || order.total_price || 0).toFixed(2)}</strong></td>
                <td><span class="status-badge status-success">${order.status || order.financial_status || 'Completed'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function loadStoreAnalytics() {
  const content = document.getElementById('analytics-content');
  content.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center; color: var(--gray-500);">Loading analytics...</p>';
  
  try {
    // Get analytics from the store endpoint
    const res = await apiCall(`/stores/${selectedStore.id}/analytics`);
    if (res.ok) {
      const analytics = await res.json();
      
      content.innerHTML = `
        <div class="analytics-grid">
          <div class="analytics-card">
            <div class="analytics-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <i class="fas fa-box"></i>
            </div>
            <div class="analytics-content">
              <div class="analytics-number">${analytics.syncedProducts || 0}</div>
              <div class="analytics-label">Synced Products</div>
              <div class="analytics-trend"><i class="fas fa-arrow-up"></i> Active</div>
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="analytics-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <div class="analytics-content">
              <div class="analytics-number">${analytics.ordersProcessed || 0}</div>
              <div class="analytics-label">Orders Processed</div>
              <div class="analytics-trend"><i class="fas fa-check-circle"></i> Synced</div>
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="analytics-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <i class="fas fa-sync"></i>
            </div>
            <div class="analytics-content">
              <div class="analytics-number">${analytics.lastSyncTime ? 'Active' : 'Pending'}</div>
              <div class="analytics-label">Sync Status</div>
              <div class="analytics-trend">${analytics.lastSyncTime ? new Date(analytics.lastSyncTime).toLocaleString() : 'Not synced yet'}</div>
            </div>
          </div>
          
          <div class="analytics-card">
            <div class="analytics-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
              <i class="fas fa-database"></i>
            </div>
            <div class="analytics-content">
              <div class="analytics-number">${selectedStore.platform}</div>
              <div class="analytics-label">Platform</div>
              <div class="analytics-trend"><i class="fas fa-plug"></i> Connected</div>
            </div>
          </div>
        </div>
      `;
    } else {
      content.innerHTML = '<div class="empty-state-card"><h3>Unable to load analytics</h3><p>Please try again later</p></div>';
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
    content.innerHTML = '<div class="empty-state-card"><h3>Error loading analytics</h3><p>Please check your connection and try again</p></div>';
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
    const data = await apiCall('/sync/pull-orders', 'POST');
    showNotification('success', data.message || 'Orders synced successfully');
    setTimeout(() => loadStoreOrders(), 2000);
  } catch (error) {
    console.error('Order sync error:', error);
    showNotification('error', 'Error syncing orders');
  }
}

// Prokip Operations Functions

// Open Create Product Modal
function openCreateProductModal() {
  if (!currentBusinessLocation) {
    showNotification('error', 'Please select a business location first');
    navigateTo('home'); // Go to home page where location selection might be available
    return;
  }
  
  document.getElementById('create-product-modal').style.display = 'flex';
  // Reset form
  document.getElementById('product-name').value = '';
  document.getElementById('product-sku').value = '';
  document.getElementById('product-sell-price').value = '';
  document.getElementById('product-purchase-price').value = '';
  document.getElementById('product-quantity').value = '';
  document.getElementById('product-description').value = '';
  document.getElementById('create-product-result').style.display = 'none';
}

// Create Product
async function createProduct() {
  console.log('createProduct called');
  const name = document.getElementById('product-name').value.trim();
  const sku = document.getElementById('product-sku').value.trim();
  const sellPrice = parseFloat(document.getElementById('product-sell-price').value);
  const purchasePrice = parseFloat(document.getElementById('product-purchase-price').value);
  const quantity = parseInt(document.getElementById('product-quantity').value);
  const description = document.getElementById('product-description').value.trim();

  console.log('Form values:', { name, sku, sellPrice, purchasePrice, quantity, description });
  console.log('currentBusinessLocation:', currentBusinessLocation);

  // Check if business location is selected
  if (!currentBusinessLocation) {
    showNotification('error', 'Please select a business location first');
    console.error('No business location selected');
    return;
  }

  // Validation
  if (!name || !sku || isNaN(sellPrice) || isNaN(purchasePrice) || isNaN(quantity)) {
    showNotification('error', 'Please fill in all required fields');
    return;
  }

  if (sellPrice < 0 || purchasePrice < 0 || quantity < 0) {
    showNotification('error', 'Prices and quantity must be positive numbers');
    return;
  }

  try {
    console.log('Making API call to create product...');
    const response = await apiCall('/prokip/products', 'POST', {
      name,
      sku,
      sellPrice,
      purchasePrice,
      quantity,
      description,
      locationId: currentBusinessLocation.id
    });
    console.log('API response:', response);

    // Display results
    const resultDiv = document.getElementById('create-product-result');
    resultDiv.style.display = 'block';
    
    if (response.prokipResult && response.storeResults) {
      let html = '<h4><i class="fas fa-check-circle"></i> Product Created Successfully</h4>';
      html += '<ul>';
      html += `<li class="success-item"><i class="fas fa-check"></i> Created in Prokip</li>`;
      
      response.storeResults.forEach(result => {
        if (result.success) {
          html += `<li class="success-item"><i class="fas fa-check"></i> Synced to ${result.store}</li>`;
        } else {
          html += `<li class="error-item"><i class="fas fa-times"></i> Failed to sync to ${result.store}: ${result.error}</li>`;
        }
      });
      
      html += '</ul>';
      resultDiv.className = 'operation-result success';
      resultDiv.innerHTML = html;
      
      showNotification('success', `Product "${name}" created successfully`);
      
      // Refresh the products list
      loadProkipProducts();
      
      // Reset form after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
    }
  } catch (error) {
    const resultDiv = document.getElementById('create-product-result');
    resultDiv.style.display = 'block';
    resultDiv.className = 'operation-result error';
    resultDiv.innerHTML = `<h4><i class="fas fa-exclamation-circle"></i> Error</h4><p>${error.message || 'Failed to create product'}</p>`;
    showNotification('error', error.message || 'Failed to create product');
  }
}

// Open Record Sale Modal
function openRecordSaleModal() {
  document.getElementById('record-sale-modal').style.display = 'flex';
  // Reset form
  document.getElementById('sale-customer-name').value = '';
  document.getElementById('sale-discount').value = '0';
  document.getElementById('record-sale-result').style.display = 'none';
  
  // Reset to single item
  const itemsList = document.getElementById('sale-items-list');
  itemsList.innerHTML = `
    <div class="sale-item-row">
      <div class="form-group">
        <input type="text" class="sale-item-sku" placeholder="SKU" required />
      </div>
      <div class="form-group">
        <input type="number" class="sale-item-quantity" placeholder="Quantity" step="1" min="1" required />
      </div>
      <div class="form-group">
        <input type="number" class="sale-item-price" placeholder="Unit Price" step="0.01" min="0" required />
      </div>
      <button type="button" class="btn-icon" onclick="removeSaleItem(this)" disabled>
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

// Add Sale Item
function addSaleItem() {
  const itemsList = document.getElementById('sale-items-list');
  const newItem = document.createElement('div');
  newItem.className = 'sale-item-row';
  newItem.innerHTML = `
    <div class="form-group">
      <input type="text" class="sale-item-sku" placeholder="SKU" required />
    </div>
    <div class="form-group">
      <input type="number" class="sale-item-quantity" placeholder="Quantity" step="1" min="1" required />
    </div>
    <div class="form-group">
      <input type="number" class="sale-item-price" placeholder="Unit Price" step="0.01" min="0" required />
    </div>
    <button type="button" class="btn-icon" onclick="removeSaleItem(this)">
      <i class="fas fa-trash"></i>
    </button>
  `;
  itemsList.appendChild(newItem);
  updateSaleItemButtons();
}

// Remove Sale Item
function removeSaleItem(button) {
  button.closest('.sale-item-row').remove();
  updateSaleItemButtons();
}

// Update Sale Item Buttons
function updateSaleItemButtons() {
  const items = document.querySelectorAll('.sale-item-row');
  items.forEach((item, index) => {
    const deleteBtn = item.querySelector('.btn-icon');
    deleteBtn.disabled = items.length === 1;
  });
}

// Record Sale
async function recordSale() {
  const customerName = document.getElementById('sale-customer-name').value.trim();
  const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
  
  // Collect items
  const items = [];
  const itemRows = document.querySelectorAll('.sale-item-row');
  
  for (const row of itemRows) {
    const sku = row.querySelector('.sale-item-sku').value.trim();
    const quantity = parseInt(row.querySelector('.sale-item-quantity').value);
    const price = parseFloat(row.querySelector('.sale-item-price').value);
    
    if (!sku || isNaN(quantity) || isNaN(price) || quantity <= 0 || price < 0) {
      showNotification('error', 'Please fill in all item fields correctly');
      return;
    }
    
    items.push({ sku, quantity, price });
  }
  
  if (items.length === 0) {
    showNotification('error', 'Please add at least one item');
    return;
  }

  try {
    const response = await apiCall('/prokip/sales', 'POST', {
      products: items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.price
      })),
      customerName: customerName || 'Walk-in Customer',
      paymentMethod: 'cash',
      locationId: currentBusinessLocation.id
    });

    // Display results
    const resultDiv = document.getElementById('record-sale-result');
    resultDiv.style.display = 'block';
    
    if (response.prokipResult && response.storeResults) {
      let html = '<h4><i class="fas fa-check-circle"></i> Sale Recorded Successfully</h4>';
      html += '<ul>';
      html += `<li class="success-item"><i class="fas fa-check"></i> Recorded in Prokip</li>`;
      
      response.storeResults.forEach(result => {
        if (result.success) {
          html += `<li class="success-item"><i class="fas fa-check"></i> Inventory updated in ${result.store}</li>`;
        } else {
          html += `<li class="error-item"><i class="fas fa-times"></i> Failed to update ${result.store}: ${result.error}</li>`;
        }
      });
      
      html += '</ul>';
      resultDiv.className = 'operation-result success';
      resultDiv.innerHTML = html;
      
      showNotification('success', 'Sale recorded successfully');
      
      // Reset form after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
    }
  } catch (error) {
    const resultDiv = document.getElementById('record-sale-result');
    resultDiv.style.display = 'block';
    resultDiv.className = 'operation-result error';
    resultDiv.innerHTML = `<h4><i class="fas fa-exclamation-circle"></i> Error</h4><p>${error.message || 'Failed to record sale'}</p>`;
    showNotification('error', error.message || 'Failed to record sale');
  }
}

// Open Record Purchase Modal
function openRecordPurchaseModal() {
  document.getElementById('record-purchase-modal').style.display = 'flex';
  // Reset form
  document.getElementById('purchase-supplier-name').value = '';
  document.getElementById('record-purchase-result').style.display = 'none';
  
  // Reset to single item
  const itemsList = document.getElementById('purchase-items-list');
  itemsList.innerHTML = `
    <div class="purchase-item-row">
      <div class="form-group">
        <input type="text" class="purchase-item-sku" placeholder="SKU" required />
      </div>
      <div class="form-group">
        <input type="number" class="purchase-item-quantity" placeholder="Quantity" step="1" min="1" required />
      </div>
      <div class="form-group">
        <input type="number" class="purchase-item-cost" placeholder="Unit Cost" step="0.01" min="0" required />
      </div>
      <button type="button" class="btn-icon" onclick="removePurchaseItem(this)" disabled>
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

// Add Purchase Item
function addPurchaseItem() {
  const itemsList = document.getElementById('purchase-items-list');
  const newItem = document.createElement('div');
  newItem.className = 'purchase-item-row';
  newItem.innerHTML = `
    <div class="form-group">
      <input type="text" class="purchase-item-sku" placeholder="SKU" required />
    </div>
    <div class="form-group">
      <input type="number" class="purchase-item-quantity" placeholder="Quantity" step="1" min="1" required />
    </div>
    <div class="form-group">
      <input type="number" class="purchase-item-cost" placeholder="Unit Cost" step="0.01" min="0" required />
    </div>
    <button type="button" class="btn-icon" onclick="removePurchaseItem(this)">
      <i class="fas fa-trash"></i>
    </button>
  `;
  itemsList.appendChild(newItem);
  updatePurchaseItemButtons();
}

// Remove Purchase Item
function removePurchaseItem(button) {
  button.closest('.purchase-item-row').remove();
  updatePurchaseItemButtons();
}

// Update Purchase Item Buttons
function updatePurchaseItemButtons() {
  const items = document.querySelectorAll('.purchase-item-row');
  items.forEach((item, index) => {
    const deleteBtn = item.querySelector('.btn-icon');
    deleteBtn.disabled = items.length === 1;
  });
}

// Record Purchase
async function recordPurchase() {
  const supplierName = document.getElementById('purchase-supplier-name').value.trim();
  
  if (!supplierName) {
    showNotification('error', 'Please enter supplier name');
    return;
  }
  
  // Collect items
  const items = [];
  const itemRows = document.querySelectorAll('.purchase-item-row');
  
  for (const row of itemRows) {
    const sku = row.querySelector('.purchase-item-sku').value.trim();
    const quantity = parseInt(row.querySelector('.purchase-item-quantity').value);
    const cost = parseFloat(row.querySelector('.purchase-item-cost').value);
    
    if (!sku || isNaN(quantity) || isNaN(cost) || quantity <= 0 || cost < 0) {
      showNotification('error', 'Please fill in all item fields correctly');
      return;
    }
    
    items.push({ sku, quantity, cost });
  }
  
  if (items.length === 0) {
    showNotification('error', 'Please add at least one item');
    return;
  }

  try {
    const response = await apiCall('/prokip/purchases', 'POST', {
      products: items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        unitCost: item.cost
      })),
      supplierName,
      referenceNo: `PURCHASE-${Date.now()}`,
      locationId: currentBusinessLocation.id
    });

    // Display results
    const resultDiv = document.getElementById('record-purchase-result');
    resultDiv.style.display = 'block';
    
    if (response.prokipResult && response.storeResults) {
      let html = '<h4><i class="fas fa-check-circle"></i> Purchase Recorded Successfully</h4>';
      html += '<ul>';
      html += `<li class="success-item"><i class="fas fa-check"></i> Recorded in Prokip</li>`;
      
      response.storeResults.forEach(result => {
        if (result.success) {
          html += `<li class="success-item"><i class="fas fa-check"></i> Inventory updated in ${result.store}</li>`;
        } else {
          html += `<li class="error-item"><i class="fas fa-times"></i> Failed to update ${result.store}: ${result.error}</li>`;
        }
      });
      
      html += '</ul>';
      resultDiv.className = 'operation-result success';
      resultDiv.innerHTML = html;
      
      showNotification('success', 'Purchase recorded successfully');
      
      // Reset form after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
    }
  } catch (error) {
    const resultDiv = document.getElementById('record-purchase-result');
    resultDiv.style.display = 'block';
    resultDiv.className = 'operation-result error';
    resultDiv.innerHTML = `<h4><i class="fas fa-exclamation-circle"></i> Error</h4><p>${error.message || 'Failed to record purchase'}</p>`;
    showNotification('error', error.message || 'Failed to record purchase');
  }
}

// Load and display Prokip products
async function loadProkipProducts() {
  const productsList = document.getElementById('prokip-products-list');

  try {
    // Show loading state
    productsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading products...</p>
      </div>
    `;

    // Fetch products from setup route (which gets from Prokip)
    const response = await apiCall('/setup/products', 'GET');

    if (response.data && response.data.length > 0) {
      let html = '';

      response.data.forEach(product => {
        const sellPrice = product.product_variations?.[0]?.variations?.[0]?.sell_price_inc_tax || '0.00';
        const quantity = product.product_variations?.[0]?.variations?.[0]?.variation_location_details?.[0]?.qty_available || '0';
        const sku = product.sku;

        html += `
          <div class="product-item">
            <div class="product-icon">
              <i class="fas fa-box"></i>
            </div>
            <div class="product-details">
              <div class="product-name">${product.name}</div>
              <div class="product-meta">
                <span class="product-price">
                  <i class="fas fa-tag"></i> $${sellPrice}
                </span>
                <span class="product-stock">
                  <i class="fas fa-warehouse"></i> ${quantity} in stock
                </span>
                <span class="product-sku">
                  <i class="fas fa-hashtag"></i> ${sku}
                </span>
              </div>
            </div>
            <div class="product-actions">
              <button class="btn-small" onclick="viewProductDetails(${product.id})" title="View Details">
                <i class="fas fa-eye"></i> View
              </button>
              <button class="btn-small" onclick="editProduct(${product.id})" title="Edit Product">
                <i class="fas fa-edit"></i> Edit
              </button>
            </div>
          </div>
        `;
      });

      productsList.innerHTML = html;
    } else {
      productsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-boxes"></i>
          <p>No products found in Prokip</p>
          <small>Create your first product using the "Create Product" button above</small>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading Prokip products:', error);
    productsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load products</p>
        <small>${error.message || 'Please check your connection and try again'}</small>
      </div>
    `;
  }
}

// View product details (placeholder for future implementation)
function viewProductDetails(productId) {
  showNotification('info', `Viewing details for product ID: ${productId}`);
  // TODO: Implement detailed product view modal
}

// Edit product (placeholder for future implementation)
function editProduct(productId) {
  showNotification('info', `Editing product ID: ${productId}`);
  // TODO: Implement product editing functionality
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
