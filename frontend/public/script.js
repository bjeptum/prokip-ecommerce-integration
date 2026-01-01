let token = '';

async function apiCall(endpoint, options = {}) {
  return fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
}

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
    token = data.token;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadStatus();
    setInterval(loadStatus, 60000); // Refresh every minute
  } else {
    document.getElementById('login-error').textContent = data.error || 'Login failed';
  }
}

async function setProkipConfig() {
  const prokipToken = document.getElementById('token').value;
  const locationId = document.getElementById('locationId').value;

  const res = await apiCall('/connections/prokip', {
    method: 'POST',
    body: JSON.stringify({ token: prokipToken, locationId })
  });

  alert(res.ok ? 'Prokip config saved' : 'Failed');
}

function connectShopify() {
  const store = document.getElementById('shopify-store').value;
  if (!store) return alert('Enter store URL');
  window.location.href = `/connections/shopify?store=${store}`;
}

async function connectWoo() {
  const storeUrl = document.getElementById('woo-url').value;
  const key = document.getElementById('woo-key').value;
  const secret = document.getElementById('woo-secret').value;

  const res = await apiCall('/connections/woocommerce', {
    method: 'POST',
    body: JSON.stringify({ storeUrl, consumerKey: key, consumerSecret: secret })
  });

  alert(res.ok ? 'WooCommerce connected' : 'Connection failed');
}

async function pushProducts() {
  const connectionId = document.getElementById('connection-select').value;
  if (!connectionId) return alert('Select a connection');

  const res = await apiCall('/setup/products', {
    method: 'POST',
    body: JSON.stringify({ method: 'push', connectionId })
  });

  const data = await res.json();
  alert(data.message || 'Push complete');
}

function pullProducts() {
  alert('Pull not supported by Prokip API');
}

async function loadProductSetup() {
  const connectionId = document.getElementById('connection-select').value;
  if (!connectionId) return alert('Select a connection');

  const res = await apiCall('/setup/products');
  const data = await res.json();
  
  if (res.ok) {
    const tbody = document.getElementById('product-tbody');
    tbody.innerHTML = '';
    
    data.prokipProducts.forEach(product => {
      const row = `<tr>
        <td>${product.sku}</td>
        <td>${product.name}</td>
        <td>${product.price}</td>
        <td>Prokip</td>
        <td><input type="checkbox" class="product-checkbox" data-sku="${product.sku}" data-source="prokip"></td>
      </tr>`;
      tbody.innerHTML += row;
    });
    
    data.storeProducts.filter(p => p.connectionId == connectionId).forEach(product => {
      const row = `<tr>
        <td>${product.sku}</td>
        <td>${product.name}</td>
        <td>${product.price}</td>
        <td>Store</td>
        <td>Already in Store</td>
      </tr>`;
      tbody.innerHTML += row;
    });
    
    document.getElementById('product-list').style.display = 'block';
  } else {
    alert('Failed to load products');
  }
}

async function pushSelectedProducts() {
  const connectionId = document.getElementById('connection-select').value;
  const checkboxes = document.querySelectorAll('.product-checkbox:checked');
  
  if (checkboxes.length === 0) return alert('Select products to push');
  
  // For simplicity, push all Prokip products again
  const res = await apiCall('/setup/products', {
    method: 'POST',
    body: JSON.stringify({ method: 'push', connectionId })
  });
  
  alert(res.ok ? 'Products pushed' : 'Push failed');
}

async function manualSync() {
  const res = await apiCall('/sync', { method: 'POST' });
  alert(res.ok ? 'Sync started' : 'Sync failed');
  loadStatus();
}

async function pullOrders() {
  const res = await apiCall('/sync/pull-orders', { method: 'POST' });
  alert(res.ok ? 'Orders pulled' : 'Pull failed');
  loadStatus();
}

async function pauseSync() {
  const res = await apiCall('/sync/pause', { method: 'POST' });
  alert(res.ok ? 'Sync paused' : 'Pause failed');
}

async function resumeSync() {
  const res = await apiCall('/sync/resume', { method: 'POST' });
  alert(res.ok ? 'Sync resumed' : 'Resume failed');
}

async function loadStatus() {
  const res = await apiCall('/sync/status');
  const connections = await res.json();

  const statusDiv = document.getElementById('status-list');
  statusDiv.innerHTML = '<h3>Connected Stores</h3><ul>' +
    connections.map(c => `<li>${c.platform.toUpperCase()} - ${c.storeUrl} (Last sync: ${c.lastSync || 'Never'}) <button onclick="disconnectStore(${c.id})">Disconnect</button></li>`).join('') +
    '</ul>';

  const select = document.getElementById('connection-select');
  select.innerHTML = '<option value="">Select store...</option>' +
    connections.map(c => `<option value="${c.id}">${c.platform} - ${c.storeUrl}</option>`).join('');
}

async function disconnectStore(id) {
  if (!confirm('Are you sure you want to disconnect this store? This will stop all syncs.')) return;
  
  const res = await apiCall(`/connections/${id}`, { method: 'DELETE' });
  if (res.ok) {
    alert('Store disconnected');
    loadStatus();
  } else {
    alert('Disconnect failed');
  }
}
