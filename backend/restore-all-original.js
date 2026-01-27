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

// Original WooCommerce products with unique SKUs
const originalProducts = [
  {
    name: "Vision vitale",
    sku: "VISION-VITALE-001",
    price: "2999.00",
    stock_quantity: 10,
    description: "Premium vision supplement for eye health"
  },
  {
    name: "Kuding Tea", 
    sku: "KUDING-TEA-002",
    price: "1599.00",
    stock_quantity: 25,
    description: "Traditional Chinese herbal tea for wellness"
  },
  {
    name: "Mebo GI Capsule",
    sku: "MEBO-GI-003", 
    price: "2499.00",
    stock_quantity: 15,
    description: "Gastrointestinal health supplement capsules"
  },
  {
    name: "Mebo GI Capsule Plus",
    sku: "MEBO-GI-004",
    price: "2799.00", 
    stock_quantity: 12,
    description: "Enhanced GI health formula with probiotics"
  },
  {
    name: "After Sun Tan Intensifying Moisturizing Lotion",
    sku: "AFTERSUN-LOTION-005",
    price: "1899.00",
    stock_quantity: 30,
    description: "Intensifying moisturizer for post-sun care"
  },
  {
    name: "Sunissime The After Sun Sorbet 50ml",
    sku: "SUNISSIME-SORBET-006", 
    price: "2299.00",
    stock_quantity: 20,
    description: "Cooling after-sun sorbet treatment"
  },
  {
    name: "Watermelon Tanning Oil SPF15 100ml",
    sku: "WATERMELON-OIL-007",
    price: "1699.00",
    stock_quantity: 35,
    description: "Natural tanning oil with SPF15 protection"
  },
  {
    name: "Anthelios Hydrating Lotion Eco-Tube SPF50+ 250ml",
    sku: "ANTHELIOS-LOTION-008",
    price: "3499.00",
    stock_quantity: 18,
    description: "High-performance SPF50+ hydrating lotion"
  },
  {
    name: "Photoderm Nude Touch Mineral SPF50+",
    sku: "PHOTODERM-MINERAL-009",
    price: "3199.00",
    stock_quantity: 22,
    description: "Mineral-based SPF50+ sunscreen for sensitive skin"
  },
  {
    name: "Sun Secure Blur Optical Mousse Cream SPF50+ 50ml",
    sku: "SUNSECURE-MOUSSE-010",
    price: "2899.00",
    stock_quantity: 25,
    description: "Blur optical mousse with SPF50+ protection"
  },
  {
    name: "Professional Semi Di Lino Scalp Relief Calming Tonic 125ml",
    sku: "SCALP-TONIC-011",
    price: "1999.00",
    stock_quantity: 16,
    description: "Professional scalp calming treatment"
  },
  {
    name: "Clay Hair Wax",
    sku: "CLAY-WAX-012",
    price: "899.00",
    stock_quantity: 40,
    description: "Natural clay-based hair styling wax"
  },
  {
    name: "Coils & Curls Co-Wash 100ml",
    sku: "CURLS-COWASH-013",
    price: "1299.00",
    stock_quantity: 28,
    description: "Moisturizing co-wash for curly hair"
  },
  {
    name: "Keratin Repair Nourish & Repair Conditioner 150ml",
    sku: "KERATIN-COND-014",
    price: "1599.00",
    stock_quantity: 32,
    description: "Repairing conditioner with keratin complex"
  },
  {
    name: "Dercos Mineral Soft Fortifying Shampoo 400ml",
    sku: "DERCOS-SHAMPOO-015",
    price: "1899.00",
    stock_quantity: 24,
    description: "Mineral soft fortifying shampoo"
  },
  {
    name: "Frizz Dismiss Shampoo",
    sku: "FRIZZ-SHAMPOO-016",
    price: "1799.00",
    stock_quantity: 20,
    description: "Anti-frizz smoothing shampoo"
  },
  {
    name: "Protection Sun-Exposed Hair Oil With Tamanu & Monoi 100ml",
    sku: "HAIR-OIL-017",
    price: "1499.00",
    stock_quantity: 18,
    description: "Protective hair oil for sun-exposed hair"
  },
  {
    name: "Care Body & Hair Oil Mist SPF30 150ml",
    sku: "OIL-MIST-018",
    price: "1699.00",
    stock_quantity: 22,
    description: "SPF30 body and hair oil mist"
  },
  {
    name: "Exfoliate Pre-Shampoo Scalp Purifying Gel",
    sku: "SCALP-GEL-019",
    price: "1399.00",
    stock_quantity: 15,
    description: "Pre-shampoo scalp exfoliating gel"
  },
  {
    name: "Beauty Curly Locks Hair Mask 35ml",
    sku: "HAIR-MASK-020",
    price: "1199.00",
    stock_quantity: 26,
    description: "Intensive hair mask for curly locks"
  },
  {
    name: "Ink Airy Velvet",
    sku: "INK-VELVET-021",
    price: "2499.00",
    stock_quantity: 14,
    description: "Airy velvet foundation makeup"
  },
  {
    name: "Power Full 5 Lip Care",
    sku: "LIP-CARE-022",
    price: "899.00",
    stock_quantity: 35,
    description: "5-in-1 lip care treatment"
  },
  {
    name: "Lift Effect Lashes 741 x1 Pair",
    sku: "LASHES-741-023",
    price: "3299.00",
    stock_quantity: 12,
    description: "Professional lash lifting effect"
  },
  {
    name: "Pure Volume Mascara",
    sku: "MASCARA-024",
    price: "1599.00",
    stock_quantity: 28,
    description: "Volume-enhancing mascara"
  },
  {
    name: "Luminous Eye Tint Liquid Shadow",
    sku: "EYE-SHADOW-025",
    price: "1899.00",
    stock_quantity: 20,
    description: "Luminous liquid eye shadow"
  },
  {
    name: "Coverstick",
    sku: "COVERSTICK-026",
    price: "999.00",
    stock_quantity: 30,
    description: "Concealing cover stick makeup"
  },
  {
    name: "Tinted Super Serum SPF30",
    sku: "TINTED-SERUM-027",
    price: "2299.00",
    stock_quantity: 16,
    description: "Tinted serum with SPF30 protection"
  },
  {
    name: "Soft Touch Mousse Make-Up",
    sku: "MOUSSE-MAKEUP-028",
    price: "1799.00",
    stock_quantity: 24,
    description: "Soft touch mousse foundation"
  },
  {
    name: "Dry Foot Cream 100ml",
    sku: "FOOT-CREAM-029",
    price: "1299.00",
    stock_quantity: 18,
    description: "Intensive dry foot treatment cream"
  },
  {
    name: "Infusion Vert Repairing Multi-Layer Hand Cream 75ml",
    sku: "HAND-CREAM-030",
    price: "1499.00",
    stock_quantity: 22,
    description: "Multi-layer repairing hand cream"
  },
  {
    name: "Moisturizing Lotion Dry to Very Dry Skin",
    sku: "LOTION-DRY-031",
    price: "1999.00",
    stock_quantity: 25,
    description: "Intensive moisturizer for very dry skin"
  },
  {
    name: "Body Energizing Talasso-Scrub 700g",
    sku: "BODY-SCRUB-032",
    price: "1699.00",
    stock_quantity: 15,
    description: "Energizing talasso body scrub"
  },
  {
    name: "Dermexa Emollient Cream 200ml + Emollient Body Wash 300ml",
    sku: "DERMEXA-KIT-033",
    price: "2999.00",
    stock_quantity: 10,
    description: "Complete emollient care kit"
  },
  {
    name: "Tensage Radiance Eye Contour 15ml",
    sku: "EYE-CONTOUR-034",
    price: "2799.00",
    stock_quantity: 14,
    description: "Radiance eye contour treatment"
  },
  {
    name: "Purifying Verbena Hydrating Aloe Vera Gel Hand Soap",
    sku: "HAND-SOAP-035",
    price: "899.00",
    stock_quantity: 35,
    description: "Purifying verbena hand soap"
  },
  {
    name: "Hugo Man Eau de Toilette",
    sku: "HUGO-MAN-036",
    price: "3999.00",
    stock_quantity: 8,
    description: "Classic Hugo Man fragrance"
  },
  {
    name: "Polo Blue Eau de Toilette",
    sku: "POLO-BLUE-037",
    price: "4299.00",
    stock_quantity: 6,
    description: "Fresh Polo Blue fragrance"
  },
  {
    name: "Peptides Spring Hydra-Gel Eye Patches",
    sku: "EYE-PATCHES-038",
    price: "2499.00",
    stock_quantity: 12,
    description: "Spring hydra-gel eye patches"
  },
  {
    name: "Prebiotic Face Mask & Scrub 100ml",
    sku: "FACE-MASK-039",
    price: "1899.00",
    stock_quantity: 20,
    description: "Prebiotic face mask with scrub"
  },
  {
    name: "Peptide4 Thousand Flower Mask 75ml",
    sku: "FLOWER-MASK-040",
    price: "3299.00",
    stock_quantity: 16,
    description: "Thousand flower peptide mask"
  },
  {
    name: "Royal Vita Propolis 33 Ampoule",
    sku: "PROPOLIS-041",
    price: "4499.00",
    stock_quantity: 8,
    description: "Royal propolis ampoules"
  },
  {
    name: "Bariederm-CICA Daily Serum 30ml",
    sku: "CICA-SERUM-042",
    price: "3899.00",
    stock_quantity: 10,
    description: "Daily CICA repairing serum"
  },
  {
    name: "Cleansing Foam Face & Eyes 200ml",
    sku: "CLEANSING-FOAM-043",
    price: "1599.00",
    stock_quantity: 28,
    description: "Gentle cleansing foam for face and eyes"
  },
  {
    name: "Dermato Clean Hyaluron Cleansing Gel 200ml",
    sku: "CLEANSING-GEL-044",
    price: "1799.00",
    stock_quantity: 22,
    description: "Hyaluron cleansing gel"
  }
];

async function restoreAllOriginalProducts() {
  try {
    console.log('🔄 Restoring all original WooCommerce products...');
    
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
    console.log('📝 Your original WooCommerce products are now restored!');
    
  } catch (error) {
    console.error('Restore failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

restoreAllOriginalProducts();
