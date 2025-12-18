const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

// Connections
async function listConnections() {
  return prisma.connection.findMany();
}

async function createConnection({ platform, storeName, token, locationId }) {
  return prisma.connection.create({
    data: {
      platform,
      storeName,
      token,
      status: 'connected',
      lastSync: new Date(),
      syncEnabled: true,
      locationId,
    },
  });
}

async function updateConnection(platform, data) {
  return prisma.connection.update({
    where: { platform },
    data,
  });
}

async function deleteConnection(platform) {
  return prisma.connection.deleteMany({
    where: { platform },
  });
}

async function findConnectionByPlatform(platform) {
  return prisma.connection.findFirst({
    where: { platform },
  });
}

// Inventory
async function adjustInventoryOnOrder({ sku, quantity, platform, status, orderId }) {
  const qty = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;

  const item = await prisma.inventoryItem.upsert({
    where: { sku },
    update: {},
    create: { sku, quantity: 0 },
  });

  let newQty = item.quantity;
  if (status === 'completed') {
    newQty = item.quantity - qty;
  } else if (status === 'refunded') {
    newQty = item.quantity + qty;
  }

  await prisma.inventoryItem.update({
    where: { sku },
    data: { quantity: newQty },
  });

  await prisma.sale.create({
    data: {
      orderId,
      sku,
      quantity: qty,
      platform,
    },
  });
}

module.exports = {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  findConnectionByPlatform,
  adjustInventoryOnOrder,
};

// Optional one-time bootstrap from legacy JSON file
async function bootstrapLegacyData() {
  const count = await prisma.connection.count();
  if (count > 0) return;

  const legacyPath = path.join(__dirname, '..', '..', 'connections.json');
  if (!fs.existsSync(legacyPath)) return;

  const raw = fs.readFileSync(legacyPath, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(json.connections)) return;

  for (const c of json.connections) {
    await prisma.connection.upsert({
      where: { platform: c.platform },
      update: {},
      create: {
        platform: c.platform,
        storeName: c.storeName,
        token: c.token,
        status: c.status || 'connected',
        lastSync: c.lastSync ? new Date(c.lastSync) : null,
        syncEnabled: c.syncEnabled ?? true,
        locationId: c.locationId || 'default',
        choice: c.choice || null,
      },
    });
  }
}

module.exports.bootstrapLegacyData = bootstrapLegacyData;



