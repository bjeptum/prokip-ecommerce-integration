async function loginProkip() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const response = await fetch('/login/prokip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (response.ok) alert('Prokip logged in!');
  else alert('Login failed.');
}

function connectShopify() {
  const store = document.getElementById('shopify-store').value;
  window.location.href = `/connect/shopify?store=${store}`;
}

async function connectWoo() {
  const storeUrl = document.getElementById('woo-store').value;
  const consumerKey = document.getElementById('woo-key').value;
  const consumerSecret = document.getElementById('woo-secret').value;
  const response = await fetch('/connect/woocommerce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeUrl, consumerKey, consumerSecret }),
  });
  if (response.ok) alert('WooCommerce connected!');
  else alert('Connection failed.');
}

async function setupProducts(method) {
  const connectionId = document.getElementById('connection-select').value;
  const response = await fetch('/setup/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, connectionId }),
  });
  if (response.ok) alert(`Products set up with ${method}!`);
}

async function manualSync() {
  const response = await fetch('/sync', { method: 'POST' });
  if (response.ok) alert('Sync triggered!');
}

async function loadStatus() {
  const response = await fetch('/status');
  const connections = await response.json();
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = '<ul>' + connections.map(c => `<li>${c.platform} (${c.storeUrl}): Last sync ${c.lastSync || 'Never'}</li>`).join('') + '</ul>';
  
  const select = document.getElementById('connection-select');
  select.innerHTML = connections.map(c => `<option value="${c.id}">${c.platform} - ${c.storeUrl}</option>`).join('');
}

window.onload = loadStatus;