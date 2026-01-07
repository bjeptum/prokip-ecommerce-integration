/**
 * Seed Script for Mock Prokip Database
 * Adds sample products for testing the e-commerce integration
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'mock-prokip-data.json');

// Sample products to seed
const sampleProducts = [
  {
    id: 1,
    name: "Wireless Bluetooth Mouse",
    sku: "WM-BT-001",
    type: "single",
    enable_stock: 1,
    product_variations: [{
      id: 1,
      variations: [{
        id: 1,
        sub_sku: "WM-BT-001",
        default_sell_price: "25.00",
        sell_price_inc_tax: "27.50",
        variation_location_details: [{
          qty_available: "50.0000",
          location_id: "1"
        }]
      }]
    }],
    unit: { actual_name: "Pieces", short_name: "Pc(s)" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    name: "USB Type-C Cable 2M",
    sku: "USB-TC-2M",
    type: "single",
    enable_stock: 1,
    product_variations: [{
      id: 2,
      variations: [{
        id: 2,
        sub_sku: "USB-TC-2M",
        default_sell_price: "12.00",
        sell_price_inc_tax: "13.20",
        variation_location_details: [{
          qty_available: "100.0000",
          location_id: "1"
        }]
      }]
    }],
    unit: { actual_name: "Pieces", short_name: "Pc(s)" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    name: "Bluetooth Wireless Headphones",
    sku: "BT-HP-001",
    type: "single",
    enable_stock: 1,
    product_variations: [{
      id: 3,
      variations: [{
        id: 3,
        sub_sku: "BT-HP-001",
        default_sell_price: "75.00",
        sell_price_inc_tax: "82.50",
        variation_location_details: [{
          qty_available: "25.0000",
          location_id: "1"
        }]
      }]
    }],
    unit: { actual_name: "Pieces", short_name: "Pc(s)" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 4,
    name: "Gaming Mechanical Keyboard",
    sku: "KB-GM-001",
    type: "single",
    enable_stock: 1,
    product_variations: [{
      id: 4,
      variations: [{
        id: 4,
        sub_sku: "KB-GM-001",
        default_sell_price: "120.00",
        sell_price_inc_tax: "132.00",
        variation_location_details: [{
          qty_available: "15.0000",
          location_id: "1"
        }]
      }]
    }],
    unit: { actual_name: "Pieces", short_name: "Pc(s)" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 5,
    name: "27-inch 4K Monitor",
    sku: "MON-27-4K",
    type: "single",
    enable_stock: 1,
    product_variations: [{
      id: 5,
      variations: [{
        id: 5,
        sub_sku: "MON-27-4K",
        default_sell_price: "350.00",
        sell_price_inc_tax: "385.00",
        variation_location_details: [{
          qty_available: "8.0000",
          location_id: "1"
        }]
      }]
    }],
    unit: { actual_name: "Pieces", short_name: "Pc(s)" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

function seedDatabase() {
  try {
    // Load existing database
    let database = {
      products: [],
      sales: [],
      purchases: [],
      sellReturns: [],
      nextProductId: 1,
      nextSaleId: 1,
      nextPurchaseId: 1
    };

    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      database = JSON.parse(data);
    }

    // Only add products if database is empty
    if (database.products.length === 0) {
      database.products = sampleProducts;
      database.nextProductId = 6; // Next ID after sample products

      // Save the seeded database
      fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));

      console.log('✅ Mock Prokip database seeded with sample products!');
      console.log(`   Added ${sampleProducts.length} products`);
      console.log('   File: ' + DATA_FILE);
    } else {
      console.log('ℹ️  Database already has products, skipping seed');
      console.log(`   Current products: ${database.products.length}`);
    }

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
}

// Run the seed
seedDatabase();