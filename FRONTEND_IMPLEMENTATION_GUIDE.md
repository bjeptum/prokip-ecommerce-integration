# Frontend Implementation Guide - Prokip E-Commerce Integration

## Overview
This guide is for frontend developers to understand and update the Prokip E-Commerce Integration frontend. The frontend is built with vanilla HTML, CSS, and JavaScript and communicates with the backend API.

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Current Features](#current-features)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Authentication Flow](#authentication-flow)
5. [Component Breakdown](#component-breakdown)
6. [How to Update](#how-to-update)
7. [Testing the Frontend](#testing-the-frontend)
8. [Common Tasks](#common-tasks)

---

## Project Structure

```
frontend/
└── public/
    ├── index.html    # Main HTML structure
    ├── script.js     # All JavaScript logic
    └── styles.css    # All styling
```

**Technology Stack:**
- Pure HTML5
- Vanilla JavaScript (ES6+)
- CSS3
- Fetch API for HTTP requests
- No frameworks or libraries

---

## Current Features

### ✅ Implemented
1. **Authentication**
   - Login form with username/password
   - JWT token storage
   - Auto-hide login after success

2. **Prokip Configuration**
   - API token input
   - Location ID input
   - Save configuration to backend

3. **Store Connections**
   - Connect Shopify stores (OAuth redirect)
   - Connect WooCommerce stores (credentials)
   - Display connection status

4. **Product Management**
   - Load products from Prokip + stores
   - Display products in table
   - Select products with checkboxes
   - Push selected products to stores

5. **Sync Controls**
   - View sync status
   - Pause/Resume sync
   - Manual sync trigger
   - Display last sync time

### 🔄 Areas for Improvement
- Error handling UI
- Loading spinners
- Product filtering/search
- Bulk actions
- Real-time sync status updates
- Connection management (edit/delete)
- Product mapping interface

---

## API Endpoints Reference

### Base URL
```javascript
const API_BASE = 'http://localhost:3000';
```

### Authentication Endpoints

#### POST /auth/login
**Request:**
```json
{
  "username": "admin",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Login successful"
}
```

**Frontend Usage:**
```javascript
const res = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
```

---

### Prokip Configuration

#### POST /api/prokip-config
**Requires:** JWT token

**Request:**
```json
{
  "apiKey": "mock_prokip_api_key_12345",
  "baseUrl": "http://localhost:4000/connector/api"
}
```

**Response:**
```json
{
  "id": 1,
  "apiKey": "mock_prokip_api_key_12345",
  "baseUrl": "http://localhost:4000/connector/api"
}
```

#### GET /api/prokip-config
**Requires:** JWT token

**Response:**
```json
{
  "id": 1,
  "apiKey": "mock_prokip_api_key_12345",
  "baseUrl": "http://localhost:4000/connector/api"
}
```

---

### Store Connections

#### GET /api/connections
**Requires:** JWT token

**Response:**
```json
[
  {
    "id": 1,
    "platform": "shopify",
    "storeUrl": "test-store.myshopify.com",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": 2,
    "platform": "woocommerce",
    "storeUrl": "https://example.com",
    "status": "active",
    "createdAt": "2024-01-15T10:35:00.000Z"
  }
]
```

#### POST /api/connections (Shopify)
**Request:**
```json
{
  "platform": "shopify",
  "storeUrl": "test-store.myshopify.com",
  "accessToken": "mock_shopify_access_token"
}
```

#### POST /api/connections (WooCommerce)
**Request:**
```json
{
  "platform": "woocommerce",
  "storeUrl": "https://example.com",
  "consumerKey": "ck_mock_key",
  "consumerSecret": "cs_mock_secret"
}
```

#### DELETE /api/connections/:id
**Requires:** JWT token

---

### Product Setup

#### GET /api/setup/products
**Requires:** JWT token

**Response:**
```json
{
  "prokipProducts": [
    {
      "id": "PROD-001",
      "name": "Wireless Mouse",
      "sku": "PROD-001",
      "price": 25,
      "stock": 100,
      "source": "prokip"
    }
  ],
  "shopifyProducts": [
    {
      "id": 1,
      "title": "T-Shirt",
      "sku": "SHOP-001",
      "price": "19.99",
      "source": "shopify"
    }
  ],
  "wooProducts": [
    {
      "id": 1,
      "name": "Leather Wallet",
      "sku": "WOO-001",
      "price": "29.99",
      "source": "woocommerce"
    }
  ]
}
```

#### POST /api/setup/products
**Push products to store**

**Request:**
```json
{
  "connectionId": 1,
  "productIds": ["PROD-001", "PROD-002"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "2 products pushed to Shopify"
}
```

#### POST /api/setup/pull-inventory
**Pull inventory from Prokip**

**Response:**
```json
{
  "success": true,
  "message": "Inventory synced for 3 products",
  "updates": [...]
}
```

---

### Sync Operations

#### GET /api/sync/status
**Requires:** JWT token

**Response:**
```json
{
  "isRunning": true,
  "lastSync": "2024-01-15T10:35:00.000Z",
  "nextSync": "2024-01-15T10:40:00.000Z"
}
```

#### POST /api/sync/pause
**Response:**
```json
{
  "success": true,
  "message": "Sync paused"
}
```

#### POST /api/sync/resume
**Response:**
```json
{
  "success": true,
  "message": "Sync resumed"
}
```

#### POST /api/sync/now
**Manual sync trigger**

**Response:**
```json
{
  "success": true,
  "message": "Manual sync completed",
  "salesProcessed": 0,
  "inventoryUpdated": 3
}
```

---

## Authentication Flow

### Step 1: Login
```javascript
async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (res.ok) {
    // Save token globally
    token = data.token;
    
    // Hide login, show dashboard
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Load initial data
    loadStatus();
  } else {
    alert('Login failed: ' + data.error);
  }
}
```

### Step 2: Include Token in Requests
```javascript
let token = ''; // Global variable

async function apiCall(endpoint, options = {}) {
  return fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
}

// Usage
const res = await apiCall('/api/connections', { method: 'GET' });
```

---

## Component Breakdown

### 1. Login Section (`index.html` lines 13-20)
```html
<section id="login-section">
  <h2>Login to Dashboard</h2>
  <input type="text" id="username" placeholder="Username" />
  <input type="password" id="password" placeholder="Password" />
  <button onclick="login()">Login</button>
  <p id="login-error" style="color:red;"></p>
</section>
```

**JavaScript:** `script.js` lines 14-33
- Handles form submission
- Validates credentials
- Stores JWT token
- Shows/hides sections

---

### 2. Prokip Configuration (`index.html` lines 24-29)
```html
<section id="prokip-config">
  <h2>Prokip API Configuration</h2>
  <input type="text" id="token" placeholder="API Token" />
  <input type="text" id="locationId" placeholder="Location ID" />
  <button onclick="setProkipConfig()">Save Prokip Config</button>
</section>
```

**JavaScript:** `script.js` lines 35-44
- Saves API credentials to backend
- Shows success/error messages

**To Update:**
- Add validation for empty fields
- Show current configuration on load
- Add "Test Connection" button

---

### 3. Store Connections (`index.html` lines 31-47)
```html
<section id="connections">
  <h2>Connect Stores</h2>
  <div>
    <h3>Shopify</h3>
    <input type="text" id="shopify-store" placeholder="yourstore.myshopify.com" />
    <button onclick="connectShopify()">Connect</button>
  </div>
  <div>
    <h3>WooCommerce</h3>
    <input type="text" id="woo-url" placeholder="https://yourstore.com" />
    <input type="text" id="woo-key" placeholder="Consumer Key" />
    <input type="text" id="woo-secret" placeholder="Consumer Secret" />
    <button onclick="connectWoo()">Connect</button>
  </div>
</section>
```

**JavaScript:**
- `connectShopify()` - Redirects to OAuth (lines 46-50)
- `connectWoo()` - POST request with credentials (lines 52-62)

**To Update:**
- Show list of connected stores
- Add "Disconnect" buttons
- Show connection status (active/paused)
- Add edit functionality

---

### 4. Product Setup (`index.html` lines 49-81)
```html
<section id="product-setup">
  <h2>Product Setup</h2>
  <select id="connection-select"></select>
  <button onclick="loadProductSetup()">Load Products</button>
  <div id="product-list" style="display:none;">
    <h3>Choose Products to Sync</h3>
    <table id="product-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all" /></th>
          <th>SKU</th>
          <th>Name</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody id="product-tbody"></tbody>
    </table>
    <button onclick="pushProducts()">Push to Store</button>
    <button onclick="pullProducts()">Pull from Prokip</button>
  </div>
</section>
```

**JavaScript:**
- `loadProductSetup()` - Fetches all products (lines 64-91)
- `pushProducts()` - Push selected to store (lines 93-103)
- `pullProducts()` - Pull inventory (lines 105-107)

**Current Flow:**
1. User clicks "Load Products"
2. Fetches from `/api/setup/products`
3. Displays in table with checkboxes
4. User selects products
5. User clicks "Push to Store"
6. Selected products sent to backend

**To Update:**
- Add product search/filter
- Add pagination for large lists
- Show sync status per product
- Add bulk select by source
- Show last sync timestamp per product

---

### 5. Sync Controls (`script.js` lines 109-185)
```javascript
async function loadStatus() {
  const res = await apiCall('/api/sync/status', { method: 'GET' });
  const data = await res.json();
  
  document.getElementById('sync-status').textContent = 
    data.isRunning ? 'Running' : 'Paused';
  document.getElementById('last-sync').textContent = 
    data.lastSync || 'Never';
}

async function pauseSync() {
  await apiCall('/api/sync/pause', { method: 'POST' });
  loadStatus();
}

async function resumeSync() {
  await apiCall('/api/sync/resume', { method: 'POST' });
  loadStatus();
}

async function manualSync() {
  await apiCall('/api/sync/now', { method: 'POST' });
  alert('Sync completed');
  loadStatus();
}
```

**To Update:**
- Add loading spinner during sync
- Show progress percentage
- Display sync logs
- Add sync frequency selector
- Show next scheduled sync time

---

## How to Update

### Adding a New Feature

**Example: Add Product Search**

#### 1. Update HTML
```html
<!-- In index.html, inside product-setup section -->
<input type="text" id="product-search" placeholder="Search products..." 
       oninput="filterProducts()" />
```

#### 2. Update JavaScript
```javascript
// In script.js
function filterProducts() {
  const searchTerm = document.getElementById('product-search').value.toLowerCase();
  const rows = document.querySelectorAll('#product-tbody tr');
  
  rows.forEach(row => {
    const name = row.cells[2].textContent.toLowerCase();
    const sku = row.cells[1].textContent.toLowerCase();
    
    if (name.includes(searchTerm) || sku.includes(searchTerm)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}
```

#### 3. Update CSS (if needed)
```css
#product-search {
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
```

---

### Improving Error Handling

**Current Code (Basic):**
```javascript
const res = await apiCall('/api/connections', { method: 'GET' });
const data = await res.json();
```

**Improved Code:**
```javascript
async function getConnections() {
  try {
    const res = await apiCall('/api/connections', { method: 'GET' });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to fetch connections');
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching connections:', error);
    showNotification('Error: ' + error.message, 'error');
    return [];
  }
}
```

---

### Adding Loading Spinners

**1. Add HTML:**
```html
<div id="loading-overlay" style="display:none;">
  <div class="spinner"></div>
</div>
```

**2. Add CSS:**
```css
#loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

**3. Add JavaScript helpers:**
```javascript
function showLoading() {
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

// Usage in API calls
async function loadProductSetup() {
  showLoading();
  try {
    const res = await apiCall('/api/setup/products', { method: 'GET' });
    const data = await res.json();
    // ... rest of code
  } finally {
    hideLoading();
  }
}
```

---

### Adding Notifications

**1. Add HTML:**
```html
<div id="notification-container"></div>
```

**2. Add CSS:**
```css
#notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
}

.notification {
  background: #fff;
  border-left: 4px solid;
  padding: 15px 20px;
  margin-bottom: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  min-width: 250px;
  animation: slideIn 0.3s ease-out;
}

.notification.success {
  border-color: #4caf50;
}

.notification.error {
  border-color: #f44336;
}

.notification.info {
  border-color: #2196f3;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

**3. Add JavaScript:**
```javascript
function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  container.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Usage
showNotification('Products loaded successfully!', 'success');
showNotification('Failed to connect to store', 'error');
showNotification('Sync started...', 'info');
```

---

## Testing the Frontend

### Local Development Setup

1. **Start Backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Start Mock Servers (for testing):**
   ```bash
   cd backend
   node tests/mock-servers.js
   ```

3. **Access Frontend:**
   ```
   http://localhost:3000
   ```

---

### Testing Checklist

#### Authentication
- [ ] Can login with correct credentials
- [ ] Cannot login with wrong credentials
- [ ] Token is stored correctly
- [ ] Dashboard shows after login
- [ ] Login section hides after success

#### Prokip Configuration
- [ ] Can save Prokip API credentials
- [ ] Configuration persists after page reload
- [ ] Shows error for invalid credentials

#### Store Connections
- [ ] Can connect Shopify store
- [ ] Can connect WooCommerce store
- [ ] Connections appear in dropdown
- [ ] Can delete connections

#### Product Management
- [ ] Products load from all sources
- [ ] Can select individual products
- [ ] Can select all products
- [ ] Can push products to store
- [ ] Can pull inventory from Prokip
- [ ] Table displays correctly

#### Sync Controls
- [ ] Sync status updates
- [ ] Can pause sync
- [ ] Can resume sync
- [ ] Manual sync works
- [ ] Last sync time displays

---

## Common Tasks

### Task 1: Update Login Credentials
**File:** `frontend/public/script.js`
**Lines:** 14-33

**Current:** Username/password in form
**Update:** Can change default values or add "Remember Me"

---

### Task 2: Change API Base URL
**File:** `frontend/public/script.js`
**Lines:** 3-12

**Current:** Relative URLs (e.g., `/auth/login`)
**For Production:** Update to full URL

```javascript
const API_BASE = 'https://your-production-domain.com';

async function apiCall(endpoint, options = {}) {
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
}
```

---

### Task 3: Style Updates
**File:** `frontend/public/styles.css`

**Current:** Basic styling
**To Update:**
- Colors: Update CSS variables
- Fonts: Add Google Fonts
- Layout: Modify grid/flexbox
- Responsive: Add media queries

**Example:**
```css
:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --danger-color: #e74c3c;
  --text-color: #333;
  --bg-color: #f5f5f5;
}

body {
  font-family: 'Roboto', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
}

button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:hover {
  background-color: #2980b9;
}
```

---

### Task 4: Add Real-Time Updates
**Use WebSockets for live sync status**

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'sync-status') {
    updateSyncStatus(data.status);
  } else if (data.type === 'product-update') {
    updateProductRow(data.product);
  }
};

function updateSyncStatus(status) {
  document.getElementById('sync-status').textContent = status.isRunning ? 'Running' : 'Paused';
  document.getElementById('last-sync').textContent = status.lastSync;
}
```

---

### Task 5: Add Connection Management UI

**Add to HTML:**
```html
<section id="connection-list">
  <h2>Connected Stores</h2>
  <div id="connections-container"></div>
</section>
```

**Add JavaScript:**
```javascript
async function loadConnections() {
  const res = await apiCall('/api/connections', { method: 'GET' });
  const connections = await res.json();
  
  const container = document.getElementById('connections-container');
  container.innerHTML = '';
  
  connections.forEach(conn => {
    const card = document.createElement('div');
    card.className = 'connection-card';
    card.innerHTML = `
      <h3>${conn.platform} - ${conn.storeUrl}</h3>
      <p>Status: <span class="status-${conn.status}">${conn.status}</span></p>
      <p>Connected: ${new Date(conn.createdAt).toLocaleDateString()}</p>
      <button onclick="disconnectStore(${conn.id})">Disconnect</button>
    `;
    container.appendChild(card);
  });
}

async function disconnectStore(connectionId) {
  if (!confirm('Are you sure you want to disconnect this store?')) return;
  
  const res = await apiCall(`/api/connections/${connectionId}`, {
    method: 'DELETE'
  });
  
  if (res.ok) {
    showNotification('Store disconnected', 'success');
    loadConnections();
  } else {
    showNotification('Failed to disconnect store', 'error');
  }
}
```

---

## Best Practices

### 1. Always Handle Errors
```javascript
// ❌ Bad
const res = await apiCall('/api/products');
const data = await res.json();

// ✅ Good
try {
  const res = await apiCall('/api/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  const data = await res.json();
  return data;
} catch (error) {
  console.error(error);
  showNotification('Error loading products', 'error');
  return [];
}
```

### 2. Show Loading States
```javascript
// ✅ Good
async function loadProducts() {
  showLoading();
  try {
    const products = await fetchProducts();
    displayProducts(products);
  } finally {
    hideLoading();
  }
}
```

### 3. Validate User Input
```javascript
function setProkipConfig() {
  const apiKey = document.getElementById('token').value.trim();
  const baseUrl = document.getElementById('locationId').value.trim();
  
  if (!apiKey || !baseUrl) {
    showNotification('Please fill in all fields', 'error');
    return;
  }
  
  // Proceed with API call
}
```

### 4. Provide User Feedback
```javascript
async function pushProducts() {
  const selectedProducts = getSelectedProducts();
  
  if (selectedProducts.length === 0) {
    showNotification('Please select at least one product', 'error');
    return;
  }
  
  showLoading();
  try {
    await apiCall('/api/setup/products', {
      method: 'POST',
      body: JSON.stringify({ productIds: selectedProducts })
    });
    showNotification(`${selectedProducts.length} products pushed successfully`, 'success');
  } catch (error) {
    showNotification('Failed to push products', 'error');
  } finally {
    hideLoading();
  }
}
```

---

## Quick Reference

### File Locations
- **HTML:** `/frontend/public/index.html`
- **JavaScript:** `/frontend/public/script.js`
- **CSS:** `/frontend/public/styles.css`

### Key Functions
- `login()` - Authenticate user
- `apiCall()` - Make authenticated API requests
- `loadProductSetup()` - Load all products
- `pushProducts()` - Push products to store
- `loadStatus()` - Get sync status

### Testing Credentials
- **Username:** `admin`
- **Password:** `securepassword123`
- **Prokip API Key:** `mock_prokip_api_key_12345`
- **Prokip Base URL:** `http://localhost:4000/connector/api`

---

## Support

For backend API documentation, see:
- [TESTING_GUIDE.md](../TESTING_GUIDE.md)
- [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
- [Postman Collection](../backend/tests/Postman-Collection.json)

For issues or questions, review the backend logs at `backend/logs/` or check the browser console for frontend errors.
