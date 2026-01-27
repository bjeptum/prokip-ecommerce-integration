const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const wooSecureService = require('./src/services/wooSecureService');

const prisma = new PrismaClient();

function decryptCredentials(connection) {
  let consumerKey = connection.consumerKey;
  let consumerSecret = connection.consumerSecret;
  
  if (consumerKey && typeof consumerKey === 'string' && consumerKey.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerKey);
      consumerKey = wooSecureService.decrypt(encryptedData);
    } catch (error) {
      console.error('Failed to decrypt Consumer Key:', error.message);
    }
  }
  
  if (consumerSecret && typeof consumerSecret === 'string' && consumerSecret.startsWith('{"encrypted":')) {
    try {
      const encryptedData = JSON.parse(consumerSecret);
      consumerSecret = wooSecureService.decrypt(encryptedData);
    } catch (error) {
      console.error('Failed to decrypt Consumer Secret:', error.message);
    }
  }
  
  return { consumerKey, consumerSecret };
}

// Original WooCommerce products that were deleted during testing
const originalProducts = [
  {
    name: "Vision vitale",
    sku: "N/A",
    price: "0.00",
    stock_quantity: 0,
    description: "Vision vitale product"
  },
  {
    name: "Kuding Tea", 
    sku: "N/A",
    price: "0.00",
    stock_quantity: 0,
    description: "Kuding Tea product"
  },
  {
    name: "Mebo GI Capsule",
    sku: "N/A", 
    price: "0.00",
    stock_quantity: 0,
    description: "Mebo GI Capsule product"
  },
  {
    name: "Mebo GI Capsule",
    sku: "N/A",
    price: "0.00", 
    stock_quantity: 0,
    description: "Mebo GI Capsule duplicate product"
  },
  {
    name: "After Sun Tan Intensifying Moisturizing Lotion",
    sku: "SN-33036",
    price: "0.00",
    stock_quantity: 0,
    description: "After sun care product"
  },
  {
    name: "Sunissime The After Sun Sorbet 50ml",
    sku: "SN-33035", 
    price: "0.00",
    stock_quantity: 0,
    description: "Sunissime after sun product"
  },
  {
    name: "Watermelon Tanning Oil SPF15 100ml",
    sku: "SN-33023",
    price: "0.00",
    stock_quantity: 0,
    description: "Tanning oil with SPF protection"
  },
  {
    name: "Anthelios Hydrating Lotion Eco-Tube SPF50+ 250ml",
    sku: "SN-33019",
    price: "0.00",
    stock_quantity: 0,
    description: "High SPF hydrating lotion"
  },
  {
    name: "Photoderm Nude Touch Mineral SPF50+",
    sku: "SN-33014",
    price: "0.00",
    stock_quantity: 0,
    description: "Mineral sunscreen SPF50+"
  },
  {
    name: "Sun Secure Blur Optical Mousse Cream SPF50+ 50ml",
    sku: "SN-33012",
    price: "0.00",
    stock_quantity: 0,
    description: "Blur optical mousse with SPF50+"
  }
];

async function restoreOriginalProducts() {
  try {
    console.log('🔄 Restoring original WooCommerce products...');
    
    // Get WooCommerce connection
    const connection = await prisma.connection.findFirst({
      where: { 
        platform: 'woocommerce',
        userId: 50
      }
    });
    
    if (!connection) {
      console.log('No WooCommerce connection found');
      return;
    }
    
    const { consumerKey, consumerSecret } = decryptCredentials(connection);
    const baseUrl = connection.storeUrl.replace(/\/$/, '');
    
    let restoredCount = 0;
    
    for (const product of originalProducts) {
      try {
        console.log(`📦 Restoring: ${product.name} (SKU: ${product.sku})`);
        
        const response = await axios.post(`${baseUrl}/wp-json/wc/v3/products`, {
          name: product.name,
          sku: product.sku,
          regular_price: product.price,
          status: 'publish',
          manage_stock: true,
          stock_quantity: product.stock_quantity,
          description: product.description,
          short_description: product.description
        }, {
          auth: {
            username: consumerKey,
            password: consumerSecret
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Prokip-Integration/1.0'
          }
        });
        
        console.log(`✅ Successfully restored: ${product.name} (ID: ${response.data.id})`);
        restoredCount++;
        
        // Rate limit between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Failed to restore ${product.name}:`, error.response?.data?.message || error.message);
      }
    }
    
    console.log(`\n🎉 Restoration complete! Restored ${restoredCount} original products`);
    
  } catch (error) {
    console.error('Restore failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

restoreOriginalProducts();
