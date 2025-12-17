async function loadStores() {
    const res = await fetch('/api/connections');
    const stores = await res.json();
    const container = document.getElementById('stores');
    container.innerHTML = '';
  
    if (stores.length === 0) {
      container.innerHTML = '<p>No stores connected yet.</p>';
      return;
    }
  
    stores.forEach(store => {
      const div = document.createElement('div');
      div.className = 'store-card';
  
      div.innerHTML = `
        <strong>${store.storeName}</strong>
        <p>Status: ${store.status}</p>
        <p>Last sync: ${store.lastSync || '—'}</p>
        <p>Auto-sync: ${store.syncEnabled ? 'ON' : 'OFF'}</p>
  
        <div class="actions">
  <button class="sync" onclick="syncNow('${store.platform}')">
    Sync now
  </button>
  <button class="toggle" onclick="toggleSync('${store.platform}')">
    ${store.syncEnabled ? 'Pause sync' : 'Resume sync'}
  </button>
  <button class="disconnect" onclick="disconnect('${store.platform}')">
    Disconnect
  </button>
</div>`;
  
      container.appendChild(div);
    });
  }
  
  function connectStore(platform) {
    const location = document.getElementById('location').value;
    window.location.href = `/connect/${platform}?location=${location}`;
  }
  
  async function toggleSync(platform) {
    await fetch('/api/toggle', {
      method: 'POST',
      body: new URLSearchParams({ platform })
    });
    loadStores();
  }
  
  async function syncNow(platform) {
    await fetch('/api/sync-now', {
      method: 'POST',
      body: new URLSearchParams({ platform })
    });
    loadStores();
  }
  
  async function disconnect(platform) {
    if (!confirm('Disconnect this store? Sync will stop.')) return;
    await fetch('/api/disconnect', {
      method: 'POST',
      body: new URLSearchParams({ platform })
    });
    loadStores();
  }
  
  loadStores();
  