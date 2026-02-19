let token = '';
let currentUser = null;
let currentBusinessLocation = null;
let businessLocations = [];
let prokipToken = null;
let prokipRefreshToken = null;
let prokipExpiresIn = null;
let selectedStore = null;
let selectedConnectionId = null;
let connectedStores = [];
let productMatchesData = null;
let productReadinessData = null;

// API Configuration
const API_BASE_URL = (
  window.API_BASE_URL ||
  (document.querySelector('meta[name="api-base-url"]')?.content || '').trim() ||
  window.location.origin
).replace(/\/$/, '');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const hasOAuthParams = urlParams.has('shopify_success') || urlParams.has('shopify_error') || urlParams.has('code') || urlParams.has('shop');

  const savedAuthToken = localStorage.getItem('token');
  const savedProkipToken = localStorage.getItem('prokipToken');
  const savedLocation = localStorage.getItem('businessLocation');
  const savedLocations = localStorage.getItem('businessLocations');
  const savedUser = localStorage.getItem('currentUser');

  if (savedAuthToken) {
    token = savedAuthToken; // Local JWT for API calls
    currentUser = JSON.parse(savedUser || '{}');

    if (savedProkipToken) {
      prokipToken = savedProkipToken;
      prokipRefreshToken = localStorage.getItem('prokipRefreshToken');
    }
    if (savedLocations) {
      try {
        businessLocations = JSON.parse(savedLocations);
      } catch (error) {
        businessLocations = [];
      }
    }

    if (hasOAuthParams) {
      handleOAuthCallback();
    }

    if (savedLocation && savedProkipToken) {
      currentBusinessLocation = JSON.parse(savedLocation);
      showDashboard();
      return;
    }

    if (savedProkipToken) {
      if (businessLocations && businessLocations.length > 0) {
        showBusinessLocationSelection();
      } else {
        loadBusinessLocations();
      }
      return;
    }

    showProkipConnect();
    return;
  }

  showLogin();
});

// Handle OAuth callback from both Shopify and WooCommerce
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check for Shopify success
  if (urlParams.has('shopify_success')) {
    const store = urlParams.get('store');
    const webhooks = urlParams.get('webhooks');
    
    let message = `Successfully connected to Shopify store: ${store}`;
    if (webhooks === 'success') {
      message += '\nâœ“ Webhooks registered successfully';
    } else if (webhooks === 'failed') {
      message += '\nâš ï¸ Webhook registration failed (this is optional)';
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
  
  // Check for WooCommerce success
  if (urlParams.has('woo_success')) {
    const success = urlParams.get('woo_success');
    showNotification('success', decodeURIComponent(success));
    // Clean URL
    window.history.replaceState({}, document.title, '/');
    // Refresh dashboard data
    loadDashboardData();
    loadConnectedStores();
  }
  
  // Check for WooCommerce error
  if (urlParams.has('woo_error')) {
    const error = urlParams.get('woo_error');
    showNotification('error', `WooCommerce connection failed: ${error}`);
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

  // Use absolute URL with API_BASE_URL
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  console.log('Full URL:', url);

  try {
    const response = await fetch(url, config);
    console.log('Response status:', response.status);

    const responseData = await response.json();
    console.log('Response data:', responseData);

    if (response.status === 401) {
      console.error('Authentication failed');
      // Don't logout here - let the calling function handle the error
      throw new Error(responseData.error || 'Authentication failed');
    }

    if (!response.ok) {
      const errMessage = responseData.message || responseData.error || `HTTP ${response.status}`;
      let details = '';
      if (responseData.details) {
        details = ` - ${typeof responseData.details === 'string' ? responseData.details : JSON.stringify(responseData.details)}`;
      }
      throw new Error(`${errMessage}${details}`);
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

// Authentication functions - Local Login
async function loginLocal() {
  const usernameField = document.getElementById('username');
  const passwordField = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const loginBtnText = document.getElementById('login-btn-text');
  const loginSpinner = document.getElementById('login-spinner');

  const username = usernameField?.value?.trim() || '';
  const password = passwordField?.value || '';

  if (!username || !password) {
    document.getElementById('login-error').textContent = 'Please enter your username and password';
    return;
  }

  if (loginBtn) loginBtn.disabled = true;
  if (loginBtnText) loginBtnText.textContent = 'Signing in...';
  if (loginSpinner) loginSpinner.style.display = 'inline-block';
  document.getElementById('login-error').textContent = '';

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok && data.token) {
      token = data.token;
      currentUser = { username };
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      // Clear any old Prokip session
      prokipToken = null;
      prokipRefreshToken = null;
      prokipExpiresIn = null;
      currentBusinessLocation = null;
      businessLocations = [];
      localStorage.removeItem('prokipToken');
      localStorage.removeItem('prokipRefreshToken');
      localStorage.removeItem('businessLocation');

      showProkipConnect();
    } else {
      document.getElementById('login-error').textContent = data.error || 'Login failed. Please check your credentials.';
    }
  } catch (error) {
    document.getElementById('login-error').textContent = 'Could not connect to server. Please check your connection.';
  } finally {
    if (loginBtn) loginBtn.disabled = false;
    if (loginBtnText) loginBtnText.textContent = 'Sign In';
    if (loginSpinner) loginSpinner.style.display = 'none';
  }
}

// Connect Prokip account after local login
async function connectProkip() {
  const username = document.getElementById('prokip-username').value.trim();
  const password = document.getElementById('prokip-password').value;
  const loginBtn = document.getElementById('prokip-login-btn');
  const loginBtnText = document.getElementById('prokip-login-btn-text');
  const loginSpinner = document.getElementById('prokip-login-spinner');

  if (!username || !password) {
    document.getElementById('prokip-login-error').textContent = 'Please enter your Prokip username and password';
    return;
  }

  if (loginBtn) loginBtn.disabled = true;
  if (loginBtnText) loginBtnText.textContent = 'Connecting...';
  if (loginSpinner) loginSpinner.style.display = 'inline-block';
  document.getElementById('prokip-login-error').textContent = '';

  try {
    const res = await fetch(`${API_BASE_URL}/auth/prokip-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok && (data.access_token || data.token)) {
      if (data.token) {
        token = data.token;
        localStorage.setItem('token', token);
      }

      prokipToken = data.access_token || data.token;
      prokipRefreshToken = data.refresh_token;
      prokipExpiresIn = data.expires_in;
      currentUser = data.user || currentUser || { username };

      localStorage.setItem('prokipToken', prokipToken);
      localStorage.setItem('prokipRefreshToken', prokipRefreshToken || '');
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      if (data.locations && data.locations.length > 0) {
        businessLocations = data.locations;
        localStorage.setItem('businessLocations', JSON.stringify(businessLocations));
        showBusinessLocationSelection();
      } else {
        document.getElementById('prokip-login-error').textContent = 'No business locations found for this account.';
      }
    } else {
      document.getElementById('prokip-login-error').textContent = data.error || 'Prokip login failed. Please check your credentials.';
    }
  } catch (error) {
    document.getElementById('prokip-login-error').textContent = 'Could not connect to server. Please check your connection.';
  } finally {
    if (loginBtn) loginBtn.disabled = false;
    if (loginBtnText) loginBtnText.textContent = 'Connect Prokip';
    if (loginSpinner) loginSpinner.style.display = 'none';
  }
}

// Legacy login function (for backward compatibility)
async function login() {
  return loginLocal();
}

// Load business locations from Prokip API
async function loadBusinessLocations() {
  if (!prokipToken) {
    if (token) {
      showProkipConnect();
    } else {
      showLogin();
    }
    return;
  }

  if (businessLocations && businessLocations.length > 0) {
    showBusinessLocationSelection();
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/prokip-locations`, {
      headers: { 'Authorization': `Bearer ${token || prokipToken}` }
    });
    
    const data = await res.json();
    
    if (data.success && data.locations) {
      businessLocations = data.locations;
      localStorage.setItem('businessLocations', JSON.stringify(businessLocations));
      showBusinessLocationSelection();
    } else {
      showNotification('error', 'Could not load business locations');
      if (token) {
        showProkipConnect();
      } else {
        showLogin();
      }
    }
  } catch (error) {
    console.error('Failed to load locations:', error);
    showNotification('error', 'Failed to load business locations');
    if (token) {
      showProkipConnect();
    } else {
      showLogin();
    }
  }
}

// Show business location selection screen
function showBusinessLocationSelection() {
  document.getElementById('login-screen').style.display = 'none';
  const prokipScreen = document.getElementById('prokip-connect-screen');
  if (prokipScreen) prokipScreen.style.display = 'none';
  document.getElementById('location-selection-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';

  const locationsGrid = document.getElementById('locations-grid');
  locationsGrid.innerHTML = '';

  if (!businessLocations || businessLocations.length === 0) {
    locationsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-building"></i>
        <h3>No Business Locations Found</h3>
        <p>Please contact your administrator to set up business locations in Prokip.</p>
        <button onclick="logoutFromProkip()" class="btn-secondary">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    `;
    return;
  }

  businessLocations.forEach(location => {
    const locationCard = document.createElement('div');
    locationCard.className = 'location-card';
    locationCard.onclick = () => selectBusinessLocation(location);

    // Handle different data formats from Prokip API
    const locationName = location.name || location.location_name || 'Unnamed Location';
    const city = location.city || location.location_city || 'N/A';
    const state = location.state || location.location_state || '';
    const country = location.country || location.location_country || '';
    const phone = location.mobile || location.phone || location.location_mobile || 'No phone';
    const address = [city, state, country].filter(Boolean).join(', ') || 'N/A';

    locationCard.innerHTML = `
      <div class="location-icon">
        <i class="fas fa-building"></i>
      </div>
      <div class="location-info">
        <h3>${locationName}</h3>
        <p><i class="fas fa-map-marker-alt"></i> ${address}</p>
        <p><i class="fas fa-phone"></i> ${phone}</p>
      </div>
      <div class="location-action">
        <i class="fas fa-arrow-right"></i>
      </div>
    `;

    locationsGrid.appendChild(locationCard);
  });
}

// Select a business location
async function selectBusinessLocation(location) {
  currentBusinessLocation = location;
  localStorage.setItem('businessLocation', JSON.stringify(location));
  
  // Save location to backend and get JWT token for API authentication
  try {
    const response = await fetch(`${API_BASE_URL}/auth/prokip-location`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: JSON.stringify({
        locationId: location.id,
        access_token: prokipToken,
        refresh_token: prokipRefreshToken,
        expires_in: prokipExpiresIn,
        username: currentUser?.username || currentUser?.email
      })
    });
    
    const data = await response.json();
    
    if (data.token) {
      // Use the JWT token returned by the backend for API calls
      token = data.token;
      localStorage.setItem('token', token);
      console.log('âœ… JWT token received and stored');
    } else if (!token && prokipToken) {
      // Final fallback only if we have no local token
      token = prokipToken;
      localStorage.setItem('token', token);
      console.log('âš ï¸ Using prokipToken as fallback');
    }
  } catch (error) {
    console.error('Failed to save location to backend:', error);
    if (!token && prokipToken) {
      token = prokipToken;
      localStorage.setItem('token', token);
    }
  }
  
  // Update profile display
  document.getElementById('profile-username').textContent = currentUser?.username || currentUser?.email || 'User';
  document.getElementById('profile-location').textContent = location.name;

  // Refresh Prokip data for the new location
  console.log('ðŸ”„ Refreshing Prokip data for new location:', location.name);
  try {
    // Load fresh data for the new location
    await Promise.all([
      loadProkipProducts(),
      loadProkipSales(),
      loadProkipPurchases()
    ]);
    console.log('âœ… Prokip data refreshed for new location');
  } catch (error) {
    console.error('âŒ Failed to refresh Prokip data:', error);
  }

  showDashboard();
}

// Change business location
function changeBusinessLocation() {
  selectedStore = null;
  toggleProfileMenu();
  showBusinessLocationSelection();
}

function showProkipConnect() {
  const prokipScreen = document.getElementById('prokip-connect-screen');
  if (prokipScreen) prokipScreen.style.display = 'flex';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('location-selection-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';

  const usernameField = document.getElementById('prokip-username');
  const passwordField = document.getElementById('prokip-password');
  if (usernameField) usernameField.value = '';
  if (passwordField) passwordField.value = '';
  const error = document.getElementById('prokip-login-error');
  if (error) error.textContent = '';
}

// Logout from Prokip
async function logoutFromProkip() {
  try {
    await fetch(`${API_BASE_URL}/auth/prokip-logout`, { 
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Clear all state
  token = '';
  prokipToken = null;
  prokipRefreshToken = null;
  prokipExpiresIn = null;
  currentUser = null;
  currentBusinessLocation = null;
  selectedStore = null;
  businessLocations = [];
  
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('prokipToken');
  localStorage.removeItem('prokipRefreshToken');
  localStorage.removeItem('businessLocation');
  localStorage.removeItem('businessLocations');
  localStorage.removeItem('currentUser');
  
  showLogin();
}

// Legacy logout function
function logout() {
  return logoutFromProkip();
}

function showLogin() {
  // Keep the function for backward compatibility, but show only the Prokip login.
  showProkipConnect();
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  const prokipScreen = document.getElementById('prokip-connect-screen');
  if (prokipScreen) prokipScreen.style.display = 'none';
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
    showProkipTab('products');
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

  const statusDiv = document.getElementById('woo-connection-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
    statusDiv.innerHTML = '';
  }
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

// Test WooCommerce connection
async function testWooCommerceConnection() {
  const storeUrl = document.getElementById('woo-store-url').value.trim();
  const wooUsername = document.getElementById('woo-admin-user').value.trim();
  const wooAppPassword = document.getElementById('woo-app-password').value.trim();

  if (!storeUrl || !wooUsername || !wooAppPassword) {
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
      wooUsername,
      wooAppPassword
    });

    if (response.success) {
      showWooConnectionStatus('success', 
        `âœ… Connection successful! Store: ${response.storeInfo.url}, Products accessible: ${response.testResults.productsFetched}`
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
  const wooUsername = document.getElementById('woo-admin-user').value.trim();
  const wooAppPassword = document.getElementById('woo-app-password').value.trim();
  const storeName = document.getElementById('woo-store-name').value.trim();

  if (!storeUrl || !wooUsername || !wooAppPassword) {
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
		    wooUsername,
		    wooAppPassword,
		    storeName
		  });

		  if (response.success) {
		    showWooConnectionStatus(
		      'success',
		      response.message || `Store connected successfully: ${response.connection.storeName}`
		    );
		    
		    setTimeout(() => {
		      closeModal();
		      loadConnectedStores();
		      loadDashboardData();
		    }, 1500);
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
  
  let html = `<div class="alert alert-${type}">${message}</div>`;
  
  if (details) {
    html += `<div class="error-details"><strong>Details:</strong> ${details}</div>`;
  }
  
  if (suggestions && suggestions.length > 0) {
    html += '<div class="suggestions"><strong>Suggestions:</strong><ul>';
    suggestions.forEach(suggestion => {
      html += `<li>${suggestion}</li>`;
    });
    html += '</ul></div>';
  }
  
  statusDiv.innerHTML = html;
}

// Dashboard data loading
async function loadDashboardData() {
  try {
    const data = await apiCall('/sync/status');
    updateDashboardStats(data);
    updateStoresOverview(data.stores || data);
    updateActivityFeed(data);
    loadEcomSyncStatus();
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
  document.getElementById('dashboard-sync-status').textContent = 'Active';

  // Update Prokip-specific stats
  document.getElementById('prokip-products').textContent = prokip.products;
  document.getElementById('prokip-sales').textContent = prokip.sales;
  document.getElementById('prokip-purchases').textContent = prokip.purchases;
}

function getPrimaryStore() {
  if (selectedStore && selectedStore.id) return selectedStore;
  if (connectedStores && connectedStores.length > 0) return connectedStores[0];
  return null;
}

function populateProkipStoreSelect() {
  const select = document.getElementById('prokip-store-select');
  if (!select) return;

  select.innerHTML = '';

  if (!connectedStores || connectedStores.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No stores connected';
    select.appendChild(opt);
    return;
  }

  connectedStores.forEach(store => {
    const opt = document.createElement('option');
    opt.value = store.id;
    const name = store.storeName || store.storeUrl || `Store ${store.id}`;
    const platform = store.platform ? store.platform.charAt(0).toUpperCase() + store.platform.slice(1) : 'Store';
    opt.textContent = `${platform} - ${name}`;
    select.appendChild(opt);
  });

  const activeId = selectedStore?.id || connectedStores[0].id;
  select.value = String(activeId);
  if (!selectedStore) {
    const active = connectedStores.find(s => s.id === activeId);
    if (active) {
      selectedStore = { id: active.id, platform: active.platform, storeUrl: active.storeUrl, storeName: active.storeName };
    }
  }
}

function handleProkipStoreChange() {
  const select = document.getElementById('prokip-store-select');
  if (!select) return;
  const storeId = parseInt(select.value, 10);
  const store = connectedStores.find(s => s.id === storeId);
  if (!store) {
    selectedStore = null;
    loadEcomSyncStatus();
    return;
  }
  selectedStore = { id: store.id, platform: store.platform, storeUrl: store.storeUrl, storeName: store.storeName };
  loadEcomSyncStatus();
}

async function loadEcomSyncStatus() {
  const panel = document.getElementById('ecom-sync-status-panel');
  if (!panel) return;

  const store = getPrimaryStore();
  const storeMeta = connectedStores?.find(s => s.id === store?.id) || store;
  const storeNameEl = document.getElementById('ecom-sync-store');
  const lastSyncEl = document.getElementById('ecom-sync-last');
  const productsEl = document.getElementById('ecom-sync-products');
  const ordersEl = document.getElementById('ecom-sync-orders');
  const messageEl = document.getElementById('ecom-sync-message');

  if (!store) {
    if (storeNameEl) storeNameEl.textContent = 'No store selected';
    if (lastSyncEl) lastSyncEl.textContent = '-';
    if (productsEl) productsEl.textContent = '0';
    if (ordersEl) ordersEl.textContent = '0';
    if (messageEl) messageEl.textContent = 'Connect a store to view sync status.';
    return;
  }

  if (storeNameEl) storeNameEl.textContent = store.storeName || store.storeUrl || `Store ${store.id}`;

  try {
    const res = await apiCall(`/api/ecom/sync-status/${store.id}`);
    const lastSync = res.last_sync || res.lastSync || null;

    if (lastSyncEl) lastSyncEl.textContent = lastSync ? new Date(lastSync).toLocaleString() : 'Not synced yet';
    if (productsEl) productsEl.textContent = res.total_products || res.products_synced || 0;
    if (ordersEl) ordersEl.textContent = res.total_orders || res.orders_synced || 0;
    if (messageEl) messageEl.textContent = res.message || 'Sync status loaded';
  } catch (error) {
    if (lastSyncEl) lastSyncEl.textContent = storeMeta?.lastSync ? new Date(storeMeta.lastSync).toLocaleString() : 'Not synced yet';
    if (productsEl) productsEl.textContent = storeMeta?.productCount || 0;
    if (ordersEl) ordersEl.textContent = storeMeta?.orderCount || 0;
    if (messageEl) {
      messageEl.textContent = (error.message || '').includes('Store not connected')
        ? 'Store not connected in Prokip yet. You can still sync from WooCommerce.'
        : 'Failed to load sync status.';
    }
  }
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
    const displayName = store.storeName || store.storeUrl;
    return `
      <div class="store-overview-card">
        <div class="store-overview-header" onclick="onViewStore(${store.id})">
          <div class="store-overview-icon" style="background: ${iconBg};">
            <i class="${iconClass}"></i>
          </div>
          <div class="store-overview-info">
            <h3>${displayName}</h3>
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
          <button onclick="onShowProductSetupFlow(${store.id})" class="btn-small btn-primary">
            <i class="fas fa-sync-alt"></i> Setup Products
          </button>
          <button onclick="onViewStore(${store.id})" class="btn-small btn-secondary">
            <i class="fas fa-eye"></i> View Details
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Safer click helpers to avoid inline quote breakage
function onViewStore(storeId) {
  const store = (connectedStores || []).find(s => s.id === storeId);
  if (!store) return;
  const displayName = store.storeName || store.storeUrl;
  viewStore(store.id, store.platform, store.storeUrl, displayName);
}

function onShowProductSetupFlow(storeId) {
  const store = (connectedStores || []).find(s => s.id === storeId);
  if (!store) return;
  showProductSetupFlow(store.id, store.platform, store.storeUrl);
}

function viewStore(storeId, platform, storeUrl, storeName = null) {
  console.log('viewStore called with:', { storeId, platform, storeUrl, storeName });
  selectedStore = { id: storeId, platform, storeUrl, storeName };
  selectedConnectionId = storeId;

  // If user expects to reach the store dashboard, open the store URL in a new tab (non-blocking).
  if (storeUrl) {
    const normalizedUrl = storeUrl.startsWith('http') ? storeUrl : `https://${storeUrl}`;
    // Best-effort: don't block internal navigation; open in background tab.
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  }
  
  // Show store menu section
  document.getElementById('store-menu-section').style.display = 'block';
  
  // Update store menu title to show "Connected Store - [name]"
  const displayName = storeName || storeUrl;
  document.getElementById('store-menu-title').textContent = `Connected Store - ${displayName}`;
  populateProkipStoreSelect();
  
  // Navigate to store products page
  navigateTo('store-products');
  
  // Update the page subtitle
  document.getElementById('store-products-subtitle').textContent = `${platform} - ${storeUrl}`;

  loadEcomSyncStatus();
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

function showMatchingTab(tab, evt = null) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (evt && evt.target) {
    evt.target.classList.add('active');
  }
  
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
                      ${priceMatch ? 'âœ“ Match' : 'âš  Different'}
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
    const data = await apiCall('/setup/products', 'POST', {
      method: 'pull',
      connectionId: selectedConnectionId
    });
    showNotification('success', data.message || 'Products pulled successfully');
    setTimeout(() => loadDashboardData(), 1500);
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
    const data = await apiCall('/setup/products', 'POST', {
      method: 'push',
      connectionId: selectedConnectionId
    });
    showNotification('success', data.message || 'Products published successfully');
    setTimeout(() => loadDashboardData(), 1500);
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

  // Handle both array and object data structures
  const stores = Array.isArray(data) ? data : (data.stores || data || []);
  
  if (Array.isArray(stores)) {
    stores.forEach(store => {
      if (store.lastSync) {
        activities.push({
          message: `Synced ${store.platform} store: ${store.storeUrl}`,
          time: new Date(store.lastSync).toLocaleString(),
          icon: 'fas fa-sync'
        });
      }
    });
  }

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
    console.log('ðŸ”„ Loading connected stores...');
    const data = await apiCall('/sync/status');
    
    console.log('ðŸ“¦ Sync status response:', data);
    
    // Handle both response formats (direct array or wrapped in stores property)
    const stores = data.stores || data;
    connectedStores = Array.isArray(stores) ? stores : [];
    populateProkipStoreSelect();
    
    console.log('ðŸª Stores found:', stores.length);
    if (Array.isArray(stores)) {
      stores.forEach(store => {
        console.log(`  - ${store.platform}: ${store.storeUrl}`);
      });
    }

    const storesList = document.getElementById('stores-list');
    storesList.innerHTML = '';

    if (!Array.isArray(stores) || stores.length === 0) {
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
            <div class="store-stats">
              <span class="stat-item">
                <i class="fas fa-box"></i> ${store.productCount || 0} products
              </span>
              <span class="stat-item">
                <i class="fas fa-shopping-bag"></i> ${store.orderCount || 0} orders
              </span>
            </div>
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
    
    console.log('âœ… Connected stores loaded successfully');
    loadEcomSyncStatus();
  } catch (error) {
    console.error('âŒ Failed to load connected stores:', error);
    const storesList = document.getElementById('stores-list');
    storesList.innerHTML = '<p style="color: var(--red-500); text-align: center; padding: 20px;">Error loading stores. Please try again.</p>';
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
    // Use dynamic endpoint with connection ID parameter
    const response = await apiCall(`/stores/my-store/products?connectionId=${selectedStore.id}`);
    
    // Handle different response formats
    let products = response.products || response;
    
    // Ensure products is an array
    if (!Array.isArray(products)) {
      console.error('Products is not an array:', products);
      products = [];
    }
    
    // Sort products: in-stock items first, then out-of-stock
    products.sort((a, b) => {
      const stockA = parseInt(a.stock_quantity) || 0;
      const stockB = parseInt(b.stock_quantity) || 0;
      
      // Sort by stock (descending), so items with stock appear first
      if (stockB !== stockA) {
        return stockB - stockA;
      }
      
      // If stock is same, sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
    
    console.log('Products response:', response);
    console.log('Extracted products:', products);
    console.log('ðŸ”„ FRONTEND SORTING ACTIVE - Products sorted by stock level');
    
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
  
  // Display location information
  const locationInfo = currentBusinessLocation ? 
    `<div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
      <strong><i class="fas fa-map-marker-alt"></i> Business Location:</strong> ${currentBusinessLocation.name || 'N/A'}
      ${currentBusinessLocation.id ? `<span style="margin-left: 10px; color: #666;">(ID: ${currentBusinessLocation.id})</span>` : ''}
    </div>` : '';
  
  if (products.length === 0) {
    content.innerHTML = `
      ${locationInfo}
      <div class="empty-state-card">
        <div class="empty-state-icon">
          <i class="fas fa-box-open"></i>
        </div>
        <h3>No Products Found</h3>
        <p>This store doesn't have any products yet, or they couldn't be loaded.</p>
        <button onclick="loadStoreProducts()" class="btn-primary">
          <i class="fas fa-sync"></i> Retry
        </button>
      </div>
    `;
    return;
  }

  const currency = currentBusinessLocation?.currency || 'KES';
  const storeName = selectedStore?.storeName || selectedStore?.storeUrl || 'Store';

  content.innerHTML = `
    ${locationInfo}
    <div class="content-card">
      <div class="card-header">
        <h3><i class="fas fa-cube"></i> Products from ${storeName}</h3>
        <div class="header-stats">
          <span class="badge">${products.length} ${products.length === 1 ? 'Product' : 'Products'}</span>
          <span class="location-badge">
            <i class="fas fa-map-marker-alt"></i> ${currentBusinessLocation?.name || 'Unknown Location'}
          </span>
        </div>
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
                <td><strong class="price-text">${currency} ${parseFloat(product.price || 0).toLocaleString()}</strong></td>
                <td><span class="stock-badge ${(product.stock_quantity || 0) > 0 ? 'stock-in' : 'stock-out'}">${product.stock_quantity || 0} units</span></td>
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
  if (!content) return;
  content.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center;">Loading orders...</p>';

  try {
    // Use dynamic endpoint with connection ID parameter
    const response = await apiCall(`/stores/my-store/orders?connectionId=${selectedStore.id}`);
    
    // Handle different response formats
    const orders = response.orders || response;
    
    console.log('Orders response:', response);
    console.log('Extracted orders:', orders);
    
    displayOrders(orders);
  } catch (error) {
    console.error('Failed to load orders:', error);
    content.innerHTML = '<p style="text-align: center; color: var(--gray-500);">Error loading orders</p>';
  }
}

function displayOrders(orders) {
  const content = document.getElementById('orders-content');
  if (!content) return;
  
  // Display location information
  const locationInfo = currentBusinessLocation ? 
    `<div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
      <strong><i class="fas fa-map-marker-alt"></i> Business Location:</strong> ${currentBusinessLocation.name || 'N/A'}
      ${currentBusinessLocation.id ? `<span style="margin-left: 10px; color: #666;">(ID: ${currentBusinessLocation.id})</span>` : ''}
    </div>` : '';
  
  if (orders.length === 0) {
    content.innerHTML = `
      ${locationInfo}
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

  const currency = currentBusinessLocation?.currency || 'KES';
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
  const storeName = selectedStore?.storeName || selectedStore?.storeUrl || 'Store';

  content.innerHTML = `
    ${locationInfo}
    <div class="content-card">
      <div class="card-header">
        <h3><i class="fas fa-shopping-cart"></i> Order History from ${storeName}</h3>
        <div class="header-stats">
          <span class="badge">${orders.length} ${orders.length === 1 ? 'Order' : 'Orders'}</span>
          <span class="revenue-badge">Total: ${currency} ${totalRevenue.toLocaleString()}</span>
          <span class="location-badge">
            <i class="fas fa-map-marker-alt"></i> ${currentBusinessLocation?.name || 'Unknown Location'}
          </span>
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
              <th>Source</th>
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
                <td><strong class="price-text">${currency} ${parseFloat(order.total || order.total_price || 0).toLocaleString()}</strong></td>
                <td><span class="status-badge ${getOrderStatusClass(order.status || order.financial_status)}">${order.status || order.financial_status || 'Completed'}</span></td>
                <td><span class="source-badge store"><i class="fas fa-globe"></i> ${storeName}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getOrderStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'paid':
      return 'status-success';
    case 'pending':
    case 'on-hold':
      return 'status-warning';
    case 'processing':
      return 'status-info';
    case 'cancelled':
    case 'refunded':
    case 'failed':
      return 'status-danger';
    default:
      return 'status-secondary';
  }
}

async function loadStoreAnalytics() {
  const content = document.getElementById('analytics-content');
  if (!content) return;
  content.classList.add('loading');

  const salesEl = document.getElementById('store-dashboard-sales');
  const ordersEl = document.getElementById('store-dashboard-orders');
  const syncEl = document.getElementById('store-dashboard-sync');
  const platformEl = document.getElementById('store-dashboard-platform');
  const ordersList = document.getElementById('store-recent-orders');
  const salesSummary = document.getElementById('store-sales-summary');
  const ordersMeta = document.getElementById('store-dashboard-orders-meta');
  const salesMeta = document.getElementById('store-dashboard-sales-meta');

  if (!selectedStore) {
    if (salesEl) salesEl.textContent = '0';
    if (ordersEl) ordersEl.textContent = '0';
    if (syncEl) syncEl.textContent = 'Not synced';
    if (platformEl) platformEl.textContent = 'Store';
    if (ordersMeta) ordersMeta.textContent = '-';
    if (salesMeta) salesMeta.textContent = '-';
    if (ordersList) ordersList.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>Select a store to view orders</p></div>';
    if (salesSummary) salesSummary.innerHTML = '<div class="empty-state"><i class="fas fa-chart-line"></i><p>Select a store to view sales</p></div>';
    content.classList.remove('loading');
    return;
  }

  try {
    const [analytics, ordersRes] = await Promise.all([
      apiCall(`/stores/my-store/analytics?connectionId=${selectedStore.id}`),
      apiCall(`/stores/my-store/orders?connectionId=${selectedStore.id}`)
    ]);

    const orders = ordersRes.orders || ordersRes || [];
    const currency = currentBusinessLocation?.currency || 'KES';
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || order.total_price || 0), 0);
    const averageOrder = orders.length ? totalRevenue / orders.length : 0;
    const statusCounts = orders.reduce((acc, order) => {
      const status = (order.status || order.financial_status || 'completed').toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const lastSync = analytics.lastSyncTime || analytics.lastSync || analytics.last_sync || null;
    const storePlatform = selectedStore.platform
      ? selectedStore.platform.charAt(0).toUpperCase() + selectedStore.platform.slice(1)
      : 'Store';

    if (ordersEl) ordersEl.textContent = orders.length.toString();
    if (salesEl) salesEl.textContent = `${currency} ${totalRevenue.toLocaleString()}`;
    if (syncEl) syncEl.textContent = lastSync ? new Date(lastSync).toLocaleString() : 'Not synced';
    if (platformEl) platformEl.textContent = storePlatform;
    if (ordersMeta) ordersMeta.textContent = `Total: ${orders.length}`;
    if (salesMeta) salesMeta.textContent = `Revenue: ${currency} ${totalRevenue.toLocaleString()}`;

    const recentOrders = orders
      .slice()
      .sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))
      .slice(0, 5);

    if (ordersList) {
      if (!recentOrders.length) {
        ordersList.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No orders yet</p></div>';
      } else {
        ordersList.innerHTML = recentOrders.map(order => {
          const orderId = order.orderId || order.id || 'N/A';
          const total = order.total || order.total_price || 0;
          const status = order.status || order.financial_status || 'completed';
          const date = order.date || order.created_at
            ? new Date(order.date || order.created_at).toLocaleDateString()
            : '-';
          return `
            <div class="mini-row">
              <div class="mini-main">
                <strong>#${orderId}</strong>
                <span class="mini-muted">${date}</span>
              </div>
              <div class="mini-meta">
                <span class="status-badge ${getOrderStatusClass(status)}">${status}</span>
                <span class="mini-amount">${currency} ${parseFloat(total).toLocaleString()}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const completed = statusCounts.completed || statusCounts.paid || 0;
    const processing = statusCounts.processing || 0;
    const pending = statusCounts.pending || statusCounts['on-hold'] || 0;

    if (salesSummary) {
      salesSummary.innerHTML = `
        <div class="mini-row">
          <div class="mini-main">
            <strong>Total revenue</strong>
            <span class="mini-muted">${orders.length} orders</span>
          </div>
          <div class="mini-meta">
            <span class="mini-amount">${currency} ${totalRevenue.toLocaleString()}</span>
          </div>
        </div>
        <div class="mini-row">
          <div class="mini-main">
            <strong>Average order</strong>
            <span class="mini-muted">Per order value</span>
          </div>
          <div class="mini-meta">
            <span class="mini-amount">${currency} ${averageOrder.toFixed(2)}</span>
          </div>
        </div>
        <div class="mini-row">
          <div class="mini-main">
            <strong>Completed</strong>
            <span class="mini-muted">Delivered or paid</span>
          </div>
          <div class="mini-meta">
            <span class="status-badge status-success">${completed}</span>
          </div>
        </div>
        <div class="mini-row">
          <div class="mini-main">
            <strong>Processing</strong>
            <span class="mini-muted">In progress</span>
          </div>
          <div class="mini-meta">
            <span class="status-badge status-info">${processing}</span>
          </div>
        </div>
        <div class="mini-row">
          <div class="mini-main">
            <strong>Pending</strong>
            <span class="mini-muted">Awaiting action</span>
          </div>
          <div class="mini-meta">
            <span class="status-badge status-warning">${pending}</span>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
    if (ordersMeta) ordersMeta.textContent = '-';
    if (salesMeta) salesMeta.textContent = '-';
    if (ordersList) ordersList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load orders</p></div>';
    if (salesSummary) salesSummary.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load sales</p></div>';
  } finally {
    content.classList.remove('loading');
  }
}

async function syncStoreProducts() {
  console.log('syncStoreProducts called, selectedStore:', selectedStore);
  if (!selectedStore) {
    showNotification('error', 'Please select a store first');
    return;
  }

  // Show sync options modal
  const modalHtml = `
    <div id="sync-modal" class="modal" style="display: flex;">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2><i class="fas fa-sync-alt"></i> Sync Options</h2>
          <button class="close-btn" onclick="closeSyncModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px; color: var(--gray-600);">Choose a sync action for <strong>${selectedStore.storeName || selectedStore.storeUrl}</strong>:</p>
          
          <div class="sync-options">
            <button class="sync-option-btn" id="syncProkipOrdersBtn" onclick="syncOrdersFromProkip()">
              <i class="fas fa-sync" style="color: var(--success-color);" id="syncOrdersIcon"></i>
              <div class="sync-option-text">
                <strong id="syncOrdersText">Sync Orders from Prokip</strong>
                <span id="syncOrdersDesc">Send Prokip sales to ${selectedStore.platform} and deduct stock</span>
              </div>
            </button>

            <button class="sync-option-btn" id="pushToStoreBtn" onclick="pushProkipProductsToStore()">
              <i class="fas fa-cloud-upload-alt" style="color: var(--primary-color);" id="pushToStoreIcon"></i>
              <div class="sync-option-text">
                <strong id="pushToStoreText">Push Prokip Products to Store</strong>
                <span id="pushToStoreDesc">Create/update products in ${selectedStore.platform} from Prokip</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  const existingModal = document.getElementById('sync-modal');
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (modal) modal.remove();
}

async function viewStoreInventory() {
  // Get button elements BEFORE closing modal
  const btn = document.getElementById('viewInventoryBtn');
  const icon = document.getElementById('viewInventoryIcon');
  const text = document.getElementById('viewInventoryText');
  const desc = document.getElementById('viewInventoryDesc');
  
  closeSyncModal();
  
  // Show loading state only if elements exist
  if (btn && icon && text && desc) {
    // Disable button and show loading
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    icon.className = 'fas fa-spinner fa-spin';
    icon.style.color = 'var(--info-color)';
    text.textContent = 'Loading Inventory...';
    desc.textContent = 'Please wait while we load your inventory';
  }
  
  const content = document.getElementById('products-content');
  content.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center;">Loading inventory from store...</p>';
  
  try {
    // Use dynamic endpoint with connection ID parameter
    const response = await apiCall(`/stores/my-store/products?connectionId=${selectedStore.id}`);
    
    // Handle different response formats
    let products = response.products || response;
    
    // Ensure products is an array
    if (!Array.isArray(products)) {
      console.error('Products is not an array:', products);
      products = [];
    }
    
    // Sort products: in-stock items first, then out-of-stock
    products.sort((a, b) => {
      const stockA = parseInt(a.stock_quantity) || 0;
      const stockB = parseInt(b.stock_quantity) || 0;
      
      // Sort by stock (descending), so items with stock appear first
      if (stockB !== stockA) {
        return stockB - stockA;
      }
      
      // If stock is same, sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
    
    displayStoreInventory(products);
  } catch (error) {
    console.error('Failed to load store inventory:', error);
    content.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon" style="color: var(--danger-color);">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3>Error Loading Inventory</h3>
        <p>${error.message || 'Failed to load inventory from store'}</p>
        <button onclick="viewStoreInventory()" class="btn-primary">
          <i class="fas fa-retry"></i> Retry
        </button>
      </div>
    `;
  } finally {
    // Restore button state only if elements exist
    if (btn && icon && text && desc) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      icon.className = 'fas fa-boxes';
      icon.style.color = 'var(--info-color)';
      text.textContent = 'View Store Inventory';
      desc.textContent = `See current inventory levels from ${selectedStore.platform}`;
    }
  }
}

function displayStoreInventory(products) {
  const content = document.getElementById('products-content');
  const currency = currentBusinessLocation?.currency || 'KES';
  const storeName = selectedStore?.storeName || selectedStore?.storeUrl || 'Store';
  const platform = selectedStore?.platform || 'Store';
  const platformIcon = platform === 'shopify' ? 'fab fa-shopify' : 'fab fa-wordpress';
  
  // Ensure products is an array
  if (!Array.isArray(products)) {
    console.error('Products is not an array:', products);
    products = [];
  }
  
  if (products.length === 0) {
    content.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">
          <i class="fas fa-box-open"></i>
        </div>
        <h3>No Products Found</h3>
        <p>This store doesn't have any products yet.</p>
      </div>
    `;
    return;
  }
  
  // Calculate inventory stats
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + (parseInt(p.stock_quantity) || 0), 0);
  const inStock = products.filter(p => (parseInt(p.stock_quantity) || 0) > 0).length;
  const outOfStock = products.filter(p => (parseInt(p.stock_quantity) || 0) === 0).length;
  const lowStock = products.filter(p => {
    const stock = parseInt(p.stock_quantity) || 0;
    return stock > 0 && stock <= 10;
  }).length;

  content.innerHTML = `
    <div class="content-card">
      <div class="card-header">
        <h3><i class="${platformIcon}"></i> ${storeName} - Live Inventory</h3>
        <span class="badge badge-info"><i class="fas fa-sync-alt"></i> Live from ${platform}</span>
      </div>
      
      <div class="inventory-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; padding: 15px; background: var(--gray-100); border-radius: 8px;">
        <div class="inventory-stat" style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--primary-color);">${totalProducts}</div>
          <div style="font-size: 12px; color: var(--gray-600);">Total Products</div>
        </div>
        <div class="inventory-stat" style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--success-color);">${totalStock}</div>
          <div style="font-size: 12px; color: var(--gray-600);">Total Stock Units</div>
        </div>
        <div class="inventory-stat" style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--success-color);">${inStock}</div>
          <div style="font-size: 12px; color: var(--gray-600);">In Stock</div>
        </div>
        <div class="inventory-stat" style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: ${outOfStock > 0 ? 'var(--danger-color)' : 'var(--gray-500)'};">${outOfStock}</div>
          <div style="font-size: 12px; color: var(--gray-600);">Out of Stock</div>
        </div>
      </div>
      
      ${lowStock > 0 ? `
        <div class="alert alert-warning" style="margin-bottom: 15px; padding: 10px 15px; background: #fff3cd; border-left: 4px solid var(--warning-color); border-radius: 4px;">
          <i class="fas fa-exclamation-triangle"></i> <strong>${lowStock}</strong> product(s) have low stock (â‰¤10 units)
        </div>
      ` : ''}
      
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(product => {
              const stock = parseInt(product.stock_quantity) || 0;
              let stockClass = 'stock-in';
              let stockStatus = 'In Stock';
              if (stock === 0) {
                stockClass = 'stock-out';
                stockStatus = 'Out of Stock';
              } else if (stock <= 10) {
                stockClass = 'stock-low';
                stockStatus = 'Low Stock';
              }
              
              return `
                <tr>
                  <td>
                    <div class="product-cell">
                      <div class="product-icon"><i class="fas fa-cube"></i></div>
                      <strong>${product.name || product.title || 'Untitled Product'}</strong>
                    </div>
                  </td>
                  <td><code class="sku-code">${product.sku || 'N/A'}</code></td>
                  <td><strong class="price-text">${currency} ${parseFloat(product.price || 0).toLocaleString()}</strong></td>
                  <td>
                    <span class="stock-badge ${stockClass}">
                      ${stock} units
                    </span>
                  </td>
                  <td><span class="status-badge status-${stock === 0 ? 'danger' : stock <= 10 ? 'warning' : 'success'}">${stockStatus}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 15px; text-align: center;">
        <button onclick="syncStoreProducts()" class="btn-secondary">
          <i class="fas fa-sync-alt"></i> More Sync Options
        </button>
      </div>
    </div>
  `;
}

async function syncInventoryFromProkip() {
  // Get button elements BEFORE closing modal
  const btn = document.getElementById('syncInventoryBtn');
  const icon = document.getElementById('syncInventoryIcon');
  const text = document.getElementById('syncInventoryText');
  const desc = document.getElementById('syncInventoryDesc');
  
  closeSyncModal();
  
  // Show loading state only if elements exist
  if (btn && icon && text && desc) {
    // Disable button and show loading
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    icon.className = 'fas fa-spinner fa-spin';
    icon.style.color = 'var(--info-color)';
    text.textContent = 'Syncing Inventory...';
    desc.textContent = 'Please wait while we sync your inventory from Prokip';
  }
  
  try {
    await syncStoreOrders();
  } finally {
    // Restore button state only if elements exist
    if (btn && icon && text && desc) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      icon.className = 'fas fa-sync-alt';
      icon.style.color = 'var(--success-color)';
      text.textContent = 'Sync Orders from Store';
      desc.textContent = `Sync latest orders from ${selectedStore.platform} to Prokip`;
    }
  }
}

async function pushProductsToProkip() {
  // Get button elements BEFORE closing modal
  const btn = document.getElementById('pushProductsBtn');
  const icon = document.getElementById('pushProductsIcon');
  const text = document.getElementById('pushProductsText');
  const desc = document.getElementById('pushProductsDesc');
  
  closeSyncModal();

  if (!selectedStore) {
    const fallback = getPrimaryStore();
    if (fallback) {
      selectedStore = { id: fallback.id, platform: fallback.platform, storeUrl: fallback.storeUrl, storeName: fallback.storeName };
    }
  }

  if (!selectedStore) {
    showNotification('error', 'Please select a store first');
    return;
  }
  
  // Show loading state only if elements exist
  if (btn && icon && text && desc) {
    // Disable button and show loading
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    icon.className = 'fas fa-spinner fa-spin';
    icon.style.color = 'var(--info-color)';
    text.textContent = 'Pushing Products...';
    desc.textContent = 'Please wait while we push products to your store';
  }
  
  try {
    showNotification('info', 'Syncing products from store to Prokip...');
    const res = await apiCall('/api/ecom/sync-products', {
      method: 'POST',
      body: JSON.stringify({
        store_id: selectedStore.id,
        limit: 100,
        page: 1
      })
    });
    
    if (res.success !== false) {
      showNotification('success', res.message || 'Products synced successfully');
      loadEcomSyncStatus();
      setTimeout(() => viewStoreInventory(), 2000);
      setTimeout(() => loadProkipProducts(), 2000);
    } else {
      showNotification('error', res.error || 'Failed to sync products');
    }
  } catch (error) {
    console.error('Product sync error:', error);
    showNotification('error', 'Error syncing products: ' + (error.message || 'Unknown error'));
  } finally {
    // Restore button state only if elements exist
    if (btn && icon && text && desc) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      icon.className = 'fas fa-upload';
      icon.style.color = 'var(--warning-color)';
      text.textContent = 'Sync Products from Store';
      desc.textContent = `Sync products from ${selectedStore.platform} to Prokip`;
    }
  }
}

async function syncOrdersFromProkip() {
  const btn = document.getElementById('syncProkipOrdersBtn');
  const icon = document.getElementById('syncOrdersIcon');
  const text = document.getElementById('syncOrdersText');
  const desc = document.getElementById('syncOrdersDesc');

  closeSyncModal();

  if (btn && icon && text && desc) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    icon.className = 'fas fa-spinner fa-spin';
    text.textContent = 'Syncing orders to store...';
    desc.textContent = 'Updating WooCommerce stock from Prokip sales';
  }

  try {
    const res = await apiCall(`/api/ecom/sync-orders`, 'POST', {
      store_id: selectedStore.id,
      status: 'processing,completed'
    });
    if (res.success === false && res.error) {
      showNotification('error', res.error || 'Failed to sync Prokip orders');
    } else {
      const processed = res.orders_processed ?? res.products_updated ?? 0;
      const failed = res.orders_failed ?? res.products_failed ?? 0;
      showNotification('success', `Prokip orders synced: ${processed} processed, ${failed} failed`);
      if (Array.isArray(res.errors) && res.errors.length) {
        console.warn('Sync order errors:', res.errors);
      }
    }
  } catch (error) {
    console.error('Failed to sync orders from Prokip:', error);
    showNotification('error', error.message || 'Failed to sync Prokip orders');
  } finally {
    if (btn && icon && text && desc) {
      btn.disabled = false;
      btn.style.opacity = '1';
      icon.className = 'fas fa-sync';
      text.textContent = 'Sync Orders from Prokip';
      desc.textContent = `Send Prokip sales to ${selectedStore.platform} and deduct stock`;
    }
  }
}

async function pushProkipProductsToStore() {
  const btn = document.getElementById('pushToStoreBtn');
  const icon = document.getElementById('pushToStoreIcon');
  const text = document.getElementById('pushToStoreText');
  const desc = document.getElementById('pushToStoreDesc');

  closeSyncModal();

  if (!selectedStore) {
    const fallback = getPrimaryStore();
    if (fallback) {
      selectedStore = { id: fallback.id, platform: fallback.platform, storeUrl: fallback.storeUrl, storeName: fallback.storeName };
    }
  }

  if (!selectedStore) {
    showNotification('error', 'Please select a store first');
    return;
  }

  if (selectedStore.platform !== 'woocommerce') {
    showNotification('error', 'Push products is only supported for WooCommerce stores');
    return;
  }

  if (btn && icon && text && desc) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    icon.className = 'fas fa-spinner fa-spin';
    text.textContent = 'Pushing Products...';
    desc.textContent = 'Please wait while we push products from Prokip to your store';
  }

  try {
    showNotification('info', 'Pushing products from Prokip to store...');
    const res = await apiCall('/api/ecom/push-products', {
      method: 'POST',
      body: JSON.stringify({
        store_id: selectedStore.id,
        limit: 100
      })
    });

    if (res.success !== false) {
      showNotification('success', res.message || 'Products pushed to store successfully');
      loadEcomSyncStatus();
      setTimeout(() => viewStoreInventory(), 1500);
    } else {
      showNotification('error', res.error || res.message || 'Failed to push products to store');
    }
  } catch (error) {
    console.error('Push products to store error:', error);
    showNotification('error', 'Error pushing products: ' + (error.message || 'Unknown error'));
  } finally {
    if (btn && icon && text && desc) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      icon.className = 'fas fa-cloud-upload-alt';
      text.textContent = 'Push Prokip Products to Store';
      desc.textContent = `Create/update products in ${selectedStore.platform} from Prokip`;
    }
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

  const confirmed = confirm('Sync orders from your WooCommerce store?\n\nThis will fetch recent orders and sync them to Prokip.');
  if (!confirmed) return;

  try {
    showNotification('info', 'Syncing orders from store...');
    const data = await apiCall('/api/ecom/sync-orders', {
      method: 'POST',
      body: JSON.stringify({
        store_id: selectedStore.id,
        status: 'processing,completed',
        limit: 100,
        page: 1
      })
    });
    showNotification('success', data.message || 'Orders synced successfully');
    loadEcomSyncStatus();
    setTimeout(() => loadStoreOrders(), 2000);
    setTimeout(() => loadProkipProducts(), 2000);
  } catch (error) {
    console.error('Order sync error:', error);
    showNotification('error', 'Error syncing orders');
  }
}

// Sales Functions
async function syncStoreSales() {
  console.log('syncStoreSales called, selectedStore:', selectedStore);
  if (!selectedStore) {
    showNotification('error', 'Please select a store first');
    return;
  }

  if (selectedStore.platform === 'shopify') {
    showNotification('info', 'Shopify sales are synced automatically via webhooks');
    return;
  }

  const confirmed = confirm('Sync sales from your WooCommerce store?\n\nThis will fetch recent sales and sync them to Prokip.');
  if (!confirmed) return;

  try {
    showNotification('info', 'Syncing sales from store...');
    const data = await apiCall('/api/ecom/sync-orders', {
      method: 'POST',
      body: JSON.stringify({
        store_id: selectedStore.id,
        status: 'processing,completed',
        limit: 100,
        page: 1
      })
    });
    showNotification('success', data.message || 'Sales synced successfully');
    loadEcomSyncStatus();
    setTimeout(() => loadStoreSales(), 2000);
    setTimeout(() => loadProkipProducts(), 2000);
  } catch (error) {
    console.error('Sales sync error:', error);
    showNotification('error', 'Error syncing sales');
  }
}

async function loadStoreSales() {
  if (!selectedStore) {
    document.getElementById('sales-list').innerHTML = '<p class="text-muted">Please select a store first</p>';
    return;
  }

  const salesList = document.getElementById('sales-list');
  salesList.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center;">Loading sales...</p>';

  try {
    // Use dynamic endpoint with connection ID parameter
    const response = await apiCall(`/stores/my-store/orders?connectionId=${selectedStore.id}`);
    
    // Handle different response formats
    const orders = response.orders || response;
    
    console.log('Sales orders response:', response);
    console.log('Extracted orders for sales:', orders);
    
    // Convert orders to sales format with source info
    const storeName = selectedStore.storeName || selectedStore.storeUrl;
    const sales = orders.map(order => ({
      id: order.orderId || order.id,
      orderId: order.orderId || order.id,
      date: order.date || order.created_at,
      customer: order.customer || order.customer_name || 'Guest',
      customerName: order.customer || order.customer_name || 'Guest',
      productCount: order.items?.length || 1,
      items: order.items?.length || 1,
      quantitySold: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      total: parseFloat(order.total || 0),
      status: order.status || 'completed',
      source: 'store' // Mark as store sale
    }));
    
    displayStoreSales(sales);
  } catch (error) {
    console.error('Failed to load sales:', error);
    salesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load sales</p>
        <small>${error.message || 'Please check your connection and try again'}</small>
      </div>
    `;
  }
}

function displayStoreSales(sales) {
  const salesList = document.getElementById('sales-list');
  
  if (!sales || sales.length === 0) {
    salesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-cash-register"></i>
        <h3>No Sales Found</h3>
        <p>No sales have been synced yet. Click "Sync Sales" to fetch sales from your store.</p>
      </div>
    `;
    return;
  }

  const currency = currentBusinessLocation?.currency || 'KES';
  const storeName = selectedStore?.storeName || selectedStore?.storeUrl || 'Store';
  const totalSalesAmount = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

  salesList.innerHTML = `
    <div class="sales-summary">
      <div class="summary-card">
        <span class="summary-label">Total Sales</span>
        <span class="summary-value">${sales.length}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Total Revenue</span>
        <span class="summary-value">${currency} ${totalSalesAmount.toLocaleString()}</span>
      </div>
    </div>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Products</th>
            <th>Qty Sold</th>
            <th>Total</th>
            <th>Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${sales.map(sale => `
            <tr>
              <td><code>${sale.orderId || sale.id}</code></td>
              <td>${new Date(sale.date || sale.created_at).toLocaleDateString()}</td>
              <td>${sale.customer || sale.customerName || 'Guest'}</td>
              <td>${sale.productCount || sale.items || 1} item(s)</td>
              <td>${sale.quantitySold || sale.productCount || 1}</td>
              <td><strong>${currency} ${parseFloat(sale.total || 0).toLocaleString()}</strong></td>
              <td>
                <span class="badge ${getStatusBadgeClass(sale.status)}">
                  ${sale.status || 'completed'}
                </span>
              </td>
              <td>
                <span class="source-badge ${sale.source === 'prokip' ? 'prokip' : 'store'}">
                  <i class="fas fa-${sale.source === 'prokip' ? 'store' : 'globe'}"></i> 
                  ${sale.source === 'prokip' ? (currentBusinessLocation?.name || 'Prokip') : storeName}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updateSalesStats(sales) {
  const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  const salesCount = sales.length;
  const lastSync = sales.length > 0 
    ? new Date(Math.max(...sales.map(s => new Date(s.date || s.created_at)))).toLocaleString()
    : 'Never';

  const totalSalesEl = document.getElementById('total-sales');
  const salesCountEl = document.getElementById('sales-count');
  const lastSyncEl = document.getElementById('last-sync');
  
  if (totalSalesEl) totalSalesEl.textContent = `${currentBusinessLocation?.currency || 'KES'} ${totalSales.toLocaleString()}`;
  if (salesCountEl) salesCountEl.textContent = salesCount;
  if (lastSyncEl) lastSyncEl.textContent = lastSync;
}

function viewSaleDetails(saleId) {
  // TODO: Implement sale details modal
  showNotification('info', `Viewing details for sale ${saleId}`);
}

function showSalesSettings() {
  // TODO: Implement sales settings modal
  showNotification('info', 'Sales settings coming soon');
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

    // Fetch products from prokip route
    const storeIdParam = selectedStore?.id ? `?store_id=${selectedStore.id}` : '';
    const response = await apiCall(`/prokip/products${storeIdParam}`, 'GET');
    const prokipProductsEl = document.getElementById('prokip-products');
    if (prokipProductsEl) {
      prokipProductsEl.textContent = Array.isArray(response.products) ? response.products.length : '0';
    }

    // Display location information
    const locationInfo = response.locationId ? 
      `<div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
        <strong><i class="fas fa-map-marker-alt"></i> Business Location:</strong> ${currentBusinessLocation?.name || `Location ${response.locationId}`}
        <span style="margin-left: 10px; color: #666;">(ID: ${response.locationId})</span>
      </div>` : '';

    if (response.products && response.products.length > 0) {
      let html = '<div class="products-grid">';

      response.products.forEach(product => {
        // Get price and stock from the product data structure
        const variation = product.product_variations?.[0]?.variations?.[0];
        const sellPrice = variation?.sell_price_inc_tax || product.sell_price_inc_tax || '0.00';
        const locationDetails = variation?.variation_location_details?.[0];
        const quantity = locationDetails?.qty_available || product.qty_available || '0';
        const currency = product.currency || currentBusinessLocation?.currency || 'KES';
        const sku = product.sku || 'N/A';

        html += `
          <div class="product-item">
            <div class="product-icon">
              <i class="fas fa-box"></i>
            </div>
            <div class="product-details">
              <div class="product-name">${product.name}</div>
              <div class="product-meta">
                <span class="product-price">
                  <i class="fas fa-tag"></i> ${currency} ${parseFloat(sellPrice).toLocaleString()}
                </span>
                <span class="product-stock ${parseFloat(quantity) > 0 ? 'in-stock' : 'out-of-stock'}">
                  <i class="fas fa-warehouse"></i> ${parseFloat(quantity).toLocaleString()} in stock
                </span>
                <span class="product-sku">
                  <i class="fas fa-hashtag"></i> ${sku}
                </span>
              </div>
            </div>
          </div>
        `;
      });

      html += '</div>';
      productsList.innerHTML = locationInfo + html;
    } else {
      productsList.innerHTML = locationInfo + `
        <div class="empty-state">
          <i class="fas fa-boxes"></i>
          <p>No products found in Prokip</p>
          <small>Add products through your Prokip account</small>
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

// Load and display Prokip sales
async function loadProkipSales() {
  const salesList = document.getElementById('prokip-sales-list');

  try {
    // Show loading state
    salesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading sales...</p>
      </div>
    `;

    // Fetch sales from prokip route
    const response = await apiCall('/prokip/sales', 'GET');
    const prokipSalesEl = document.getElementById('prokip-sales');
    if (prokipSalesEl) {
      prokipSalesEl.textContent = Array.isArray(response.sales) ? response.sales.length : '0';
    }

    // Display location information
    const locationInfo = response.locationId ? 
      `<div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
        <strong><i class="fas fa-map-marker-alt"></i> Business Location:</strong> ${currentBusinessLocation?.name || `Location ${response.locationId}`}
        <span style="margin-left: 10px; color: #666;">(ID: ${response.locationId})</span>
      </div>` : '';

    if (response.sales && response.sales.length > 0) {
      const currency = currentBusinessLocation?.currency || 'KES';
      
      let html = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Products</th>
                <th>Total</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
      `;

      response.sales.forEach(sale => {
        const invoiceNo = sale.invoice_no || sale.ref_no || 'N/A';
        const date = sale.transaction_date ? new Date(sale.transaction_date).toLocaleDateString() : 'N/A';
        const customer = sale.contact?.name || sale.customer_name || 'Walk-in';
        const productCount = sale.sell_lines?.length || 0;
        const total = parseFloat(sale.final_total || 0).toLocaleString();
        const status = sale.status || 'completed';
        const source = sale.added_by || 'Prokip POS';

        html += `
          <tr>
            <td><code>${invoiceNo}</code></td>
            <td>${date}</td>
            <td>${customer}</td>
            <td>${productCount} item(s)</td>
            <td><strong>${currency} ${total}</strong></td>
            <td><span class="badge ${getStatusBadgeClass(status)}">${status}</span></td>
            <td><span class="source-badge prokip"><i class="fas fa-store"></i> ${source}</span></td>
          </tr>
        `;
      });

      html += '</tbody></table></div>';
      salesList.innerHTML = locationInfo + html;
    } else {
      salesList.innerHTML = locationInfo + `
        <div class="empty-state">
          <i class="fas fa-cash-register"></i>
          <p>No sales found</p>
          <small>Sales from your Prokip account will appear here</small>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading Prokip sales:', error);
    salesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load sales</p>
        <small>${error.message || 'Please check your connection and try again'}</small>
      </div>
    `;
  }
}

// Load and display Prokip purchases
async function loadProkipPurchases() {
  const purchasesList = document.getElementById('prokip-purchases-list');

  try {
    // Show loading state
    purchasesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading purchases...</p>
      </div>
    `;

    // Fetch purchases from prokip route
    const response = await apiCall('/prokip/purchases', 'GET');
    const prokipPurchasesEl = document.getElementById('prokip-purchases');
    if (prokipPurchasesEl) {
      prokipPurchasesEl.textContent = Array.isArray(response.purchases) ? response.purchases.length : '0';
    }

    // Display location information
    const locationInfo = response.locationId ? 
      `<div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
        <strong><i class="fas fa-map-marker-alt"></i> Business Location:</strong> ${currentBusinessLocation?.name || `Location ${response.locationId}`}
        <span style="margin-left: 10px; color: #666;">(ID: ${response.locationId})</span>
      </div>` : '';

    if (response.purchases && response.purchases.length > 0) {
      const currency = currentBusinessLocation?.currency || 'KES';
      
      let html = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Reference #</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      response.purchases.forEach(purchase => {
        const refNo = purchase.ref_no || purchase.reference_no || 'N/A';
        const date = purchase.transaction_date ? new Date(purchase.transaction_date).toLocaleDateString() : 'N/A';
        const supplier = purchase.contact?.name || purchase.supplier_name || 'Unknown';
        const itemCount = purchase.purchase_lines?.length || 0;
        const total = parseFloat(purchase.final_total || 0).toLocaleString();
        const status = purchase.status || 'received';

        html += `
          <tr>
            <td><code>${refNo}</code></td>
            <td>${date}</td>
            <td>${supplier}</td>
            <td>${itemCount} item(s)</td>
            <td><strong>${currency} ${total}</strong></td>
            <td><span class="badge ${getStatusBadgeClass(status)}">${status}</span></td>
          </tr>
        `;
      });

      html += '</tbody></table></div>';
      purchasesList.innerHTML = locationInfo + html;
    } else {
      purchasesList.innerHTML = locationInfo + `
        <div class="empty-state">
          <i class="fas fa-shopping-bag"></i>
          <p>No purchases found</p>
          <small>Purchases from your Prokip account will appear here</small>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading Prokip purchases:', error);
    purchasesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load purchases</p>
        <small>${error.message || 'Please check your connection and try again'}</small>
      </div>
    `;
  }
}

function showProkipTab(tab) {
  document.querySelectorAll('.prokip-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.prokip-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `prokip-tab-${tab}`);
  });

  if (tab === 'products') {
    loadProkipProducts();
  } else if (tab === 'sales') {
    loadProkipSales();
  } else if (tab === 'purchases') {
    loadProkipPurchases();
  }
}

// Helper function for status badge classes
function getStatusBadgeClass(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'final':
    case 'received':
    case 'paid':
      return 'badge-success';
    case 'pending':
    case 'ordered':
      return 'badge-warning';
    case 'cancelled':
    case 'refunded':
      return 'badge-danger';
    default:
      return 'badge-secondary';
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

// WooCommerce Bidirectional Sync Function
async function syncWithWooCommerce() {
  const btn = document.getElementById('sync-woocommerce-btn');
  const btnText = document.getElementById('sync-btn-text');
  const spinner = document.getElementById('sync-spinner');
  const statusDiv = document.getElementById('sync-status');
  const statusMessage = statusDiv ? statusDiv.querySelector('.status-message') : null;
  const statusDetails = statusDiv ? statusDiv.querySelector('.status-details') : null;
  
  // Check if elements exist (might be on different page)
  if (!btn || !btnText || !spinner || !statusDiv || !statusMessage || !statusDetails) {
    console.error('âŒ Sync elements not found - make sure you are on the Prokip Operations page');
    alert('Please navigate to the Prokip Operations page to use the sync feature.');
    return;
  }
  
  try {
    // Show loading state
    btn.disabled = true;
    btnText.textContent = 'Syncing...';
    spinner.style.display = 'inline-block';
    
    // Show processing status
    statusDiv.style.display = 'block';
    statusDiv.className = 'sync-status processing';
    statusMessage.textContent = 'Syncing WooCommerce orders to Prokip...';
    statusDetails.textContent = 'This may take a few moments. Please don\'t close this page.';
    
    console.log('ðŸ”„ Starting WooCommerce â†’ Prokip sync...');
    
    const store = getPrimaryStore();
    if (!store) {
      statusDiv.className = 'sync-status error';
      statusMessage.textContent = 'âŒ No Store Selected';
      statusDetails.textContent = 'Please connect and select a store before syncing.';
      return;
    }

    const result = await apiCall('/api/ecom/sync-orders', {
      method: 'POST',
      body: JSON.stringify({
        store_id: store.id,
        status: 'processing,completed',
        limit: 100,
        page: 1
      })
    });
    
    if (result && result.success !== false) {
      // Success state
      statusDiv.className = 'sync-status success';
      statusMessage.textContent = 'âœ… Sync Completed Successfully!';
      
      const details = [];
      if (result.orders_processed !== undefined) {
        details.push(`Orders processed: ${result.orders_processed}`);
      }
      if (result.orders_skipped !== undefined) {
        details.push(`Orders skipped: ${result.orders_skipped}`);
      }
      if (result.orders_failed !== undefined) {
        details.push(`Orders failed: ${result.orders_failed}`);
      }
      if (result.orders_found !== undefined) {
        details.push(`Orders found: ${result.orders_found}`);
      }
      statusDetails.textContent = details.length ? details.join(' | ') : (result.message || 'Sync completed');
      
      // Refresh dashboard data
      setTimeout(() => {
        loadDashboardData();
        loadEcomSyncStatus();
        loadProkipProducts();
      }, 2000);
      
      console.log('âœ… Sync completed:', result);
      
    } else {
      // Error state
      statusDiv.className = 'sync-status error';
      statusMessage.textContent = 'âŒ Sync Failed';
      statusDetails.textContent = result?.error || 'An unexpected error occurred during sync';
      
      console.error('âŒ Sync failed:', result);
    }
    
  } catch (error) {
    // Network/error state
    statusDiv.style.display = 'block';
    statusDiv.className = 'sync-status error';
    statusMessage.textContent = 'âŒ Connection Error';
    statusDetails.textContent = error.message || 'Failed to connect to the server. Please check your connection.';
    
    console.error('âŒ Sync error:', error);
    
  } finally {
    // Reset button state
    btn.disabled = false;
    btnText.textContent = 'Sync with WooCommerce';
    spinner.style.display = 'none';
    
    // Auto-hide status after 10 seconds on success
    if (statusDiv.classList.contains('success')) {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 10000);
    }
  }
}



