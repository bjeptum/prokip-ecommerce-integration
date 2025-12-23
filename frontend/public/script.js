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

async function manualSync() {
  const res = await apiCall('/sync', { method: 'POST' });
  alert(res.ok ? 'Sync started' : 'Sync failed');
}

async function loadStatus() {
  const res = await apiCall('/connections/status');
  const connections = await res.json();

  const statusDiv = document.getElementById('status-list');
  statusDiv.innerHTML = '<h3>Connected Stores</h3><ul>' +
    connections.map(c => `<li>${c.platform.toUpperCase()} - ${c.storeUrl} (Last sync: ${c.lastSync || 'Never'})</li>`).join('') +
    '</ul>';

  const select = document.getElementById('connection-select');
  select.innerHTML = '<option value="">Select store...</option>' +
    connections.map(c => `<option value="${c.id}">${c.platform} - ${c.storeUrl}</option>`).join('');
}
