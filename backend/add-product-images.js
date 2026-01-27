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

// Product images mapping (using placeholder images for now)
const productImages = {
  "VISION-VITALE-001": "https://picsum.photos/seed/vision-vitale/800/800.jpg",
  "KUDING-TEA-002": "https://picsum.photos/seed/kuding-tea/800/800.jpg",
  "MEBO-GI-003": "https://picsum.photos/seed/mebo-gi/800/800.jpg",
  "MEBO-GI-004": "https://picsum.photos/seed/mebo-gi-plus/800/800.jpg",
  "AFTERSUN-LOTION-005": "https://picsum.photos/seed/aftersun-lotion/800/800.jpg",
  "SUNISSIME-SORBET-006": "https://picsum.photos/seed/sunissime-sorbet/800/800.jpg",
  "WATERMELON-OIL-007": "https://picsum.photos/seed/watermelon-oil/800/800.jpg",
  "ANTHELIOS-LOTION-008": "https://picsum.photos/seed/anthelios-lotion/800/800.jpg",
  "PHOTODERM-MINERAL-009": "https://picsum.photos/seed/photoderm-mineral/800/800.jpg",
  "SUNSECURE-MOUSSE-010": "https://picsum.photos/seed/sunsecure-mousse/800/800.jpg",
  "SCALP-TONIC-011": "https://picsum.photos/seed/scalp-tonic/800/800.jpg",
  "CLAY-WAX-012": "https://picsum.photos/seed/clay-wax/800/800.jpg",
  "CURLS-COWASH-013": "https://picsum.photos/seed/curls-cowash/800/800.jpg",
  "KERATIN-COND-014": "https://picsum.photos/seed/keratin-conditioner/800/800.jpg",
  "DERCOS-SHAMPOO-015": "https://picsum.photos/seed/dercos-shampoo/800/800.jpg",
  "FRIZZ-SHAMPOO-016": "https://picsum.photos/seed/frizz-shampoo/800/800.jpg",
  "HAIR-OIL-017": "https://picsum.photos/seed/hair-oil/800/800.jpg",
  "OIL-MIST-018": "https://picsum.photos/seed/oil-mist/800/800.jpg",
  "SCALP-GEL-019": "https://picsum.photos/seed/scalp-gel/800/800.jpg",
  "HAIR-MASK-020": "https://picsum.photos/seed/hair-mask/800/800.jpg",
  "INK-VELVET-021": "https://picsum.photos/seed/ink-velvet/800/800.jpg",
  "LIP-CARE-022": "https://picsum.photos/seed/lip-care/800/800.jpg",
  "LASHES-741-023": "https://picsum.photos/seed/lashes-741/800/800.jpg",
  "MASCARA-024": "https://picsum.photos/seed/mascara/800/800.jpg",
  "EYE-SHADOW-025": "https://picsum.photos/seed/eye-shadow/800/800.jpg",
  "COVERSTICK-026": "https://picsum.photos/seed/coverstick/800/800.jpg",
  "TINTED-SERUM-027": "https://picsum.photos/seed/tinted-serum/800/800.jpg",
  "MOUSSE-MAKEUP-028": "https://picsum.photos/seed/mousse-makeup/800/800.jpg",
  "FOOT-CREAM-029": "https://picsum.photos/seed/foot-cream/800/800.jpg",
  "HAND-CREAM-030": "https://picsum.photos/seed/hand-cream/800/800.jpg",
  "LOTION-DRY-031": "https://picsum.photos/seed/lotion-dry/800/800.jpg",
  "BODY-SCRUB-032": "https://picsum.photos/seed/body-scrub/800/800.jpg",
  "DERMEXA-KIT-033": "https://picsum.photos/seed/dermexa-kit/800/800.jpg",
  "EYE-CONTOUR-034": "https://picsum.photos/seed/eye-contour/800/800.jpg",
  "HAND-SOAP-035": "https://picsum.photos/seed/hand-soap/800/800.jpg",
  "HUGO-MAN-036": "https://picsum.photos/seed/hugo-man/800/800.jpg",
  "POLO-BLUE-037": "https://picsum.photos/seed/polo-blue/800/800.jpg",
  "EYE-PATCHES-038": "https://picsum.photos/seed/eye-patches/800/800.jpg",
  "FACE-MASK-039": "https://picsum.photos/seed/face-mask/800/800.jpg",
  "FLOWER-MASK-040": "https://picsum.photos/seed/flower-mask/800/800.jpg",
  "PROPOLIS-041": "https://picsum.photos/seed/propolis/800/800.jpg",
  "CICA-SERUM-042": "https://picsum.photos/seed/cica-serum/800/800.jpg",
  "CLEANSING-FOAM-043": "https://picsum.photos/seed/cleansing-foam/800/800.jpg",
  "CLEANSING-GEL-044": "https://picsum.photos/seed/cleansing-gel/800/800.jpg"
};

async function addProductImages() {
  try {
    console.log('🖼️ Adding images to WooCommerce products...');
    
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
    
    // Get all products
    const response = await axios.get(`${baseUrl}/wp-json/wc/v3/products?per_page=100`, {
      auth: {
        username: consumerKey,
        password: consumerSecret
      }
    });
    
    const products = response.data;
    let updatedCount = 0;
    
    for (const product of products) {
      if (product.sku && productImages[product.sku]) {
        try {
          console.log(`🖼️ Adding image to: ${product.name} (SKU: ${product.sku})`);
          
          // Update product with image
          const updateResponse = await axios.put(`${baseUrl}/wp-json/wc/v3/products/${product.id}`, {
            images: [
              {
                src: productImages[product.sku],
                alt: product.name,
                name: product.name
              }
            ]
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
          
          console.log(`✅ Image added to: ${product.name}`);
          updatedCount++;
          
          // Rate limit between requests
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ Failed to add image to ${product.name}:`, error.response?.data?.message || error.message);
        }
      }
    }
    
    console.log(`\n🎉 Image addition complete! Added images to ${updatedCount} products`);
    
  } catch (error) {
    console.error('Image addition failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addProductImages();
