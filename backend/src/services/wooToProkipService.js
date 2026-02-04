/**
 * WOOCOMMERCE TO PROKIP STOCK INTEGRATION SERVICE
 * Real-time stock deduction when WooCommerce orders are placed
 */

const prisma = require('../lib/prisma');
const prokipEcomClient = require('./prokipEcomClient');

class WooCommerceToProkipService {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000;
  }

  /**
   * Process WooCommerce order and deduct stock from Prokip
   */
  async processOrder(orderData, connectionId) {
    try {
      console.log('🛒 Processing WooCommerce order for Prokip stock deduction...');
      
      // Get connection details
      const connection = await prisma.connection.findUnique({
        where: { id: connectionId }
      });
      
      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      // Get Prokip configuration
      const prokipConfig = await prisma.prokipConfig.findFirst({
        where: { userId: connection.userId }
      });
      
      if (!prokipConfig) {
        throw new Error('Prokip configuration not found');
      }

      console.log(`📦 Processing order ${orderData.id} for user ${connection.userId}`);
      
      // Trigger Prokip-2 sync-orders (single pipeline)
      const result = await prokipEcomClient.syncOrders({
        store_id: connection.id,
        status: orderData.status || 'processing',
        limit: 1,
        page: 1
      }, connection.userId);
      
      // Log the transaction
      await this.logStockTransaction(orderData, [], connectionId, result);
      
      console.log('✅ Stock deduction completed successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to process order for stock deduction:', error.message);
      throw error;
    }
  }

  /**
   * Map WooCommerce order items to Prokip stock deduction format
   */
  async mapOrderToStockDeduction(orderData, prokipConfig) {
    const deductions = [];
    
    for (const item of orderData.line_items || []) {
      try {
        // Find Prokip product by SKU
        const prokipProduct = await this.findProkipProductBySku(item.sku, prokipConfig.userId);
        
        if (!prokipProduct) {
          console.log(`⚠️ Product with SKU ${item.sku} not found in Prokip`);
          continue;
        }

        // Get variation ID from Prokip product
        const variationId = await this.getVariationIdFromProduct(prokipProduct, item.sku);
        
        if (!variationId) {
          console.log(`⚠️ No variation ID found for SKU ${item.sku}`);
          continue;
        }

        deductions.push({
          variation_id: variationId,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.price || item.total / item.quantity),
          product_name: item.name,
          sku: item.sku,
          woo_product_id: item.product_id,
          woo_variation_id: item.variation_id || null
        });
        
      } catch (error) {
        console.error(`❌ Error mapping item ${item.sku}:`, error.message);
      }
    }
    
    return deductions;
  }

  /**
   * Find Prokip product by SKU
   */
  async findProkipProductBySku(sku, userId) {
    try {
      const prokipService = require('./prokipService');
      const products = await prokipService.getProducts(null, userId);
      
      return products.find(p => p.sku === sku);
    } catch (error) {
      console.error(`❌ Error finding Prokip product for SKU ${sku}:`, error.message);
      return null;
    }
  }

  /**
   * Get variation ID from Prokip product
   */
  async getVariationIdFromProduct(prokipProduct, sku) {
    try {
      // If product has variations, find the matching one
      if (prokipProduct.product_variations && prokipProduct.product_variations.length > 0) {
        for (const variation of prokipProduct.product_variations) {
          if (variation.variations && variation.variations.length > 0) {
            for (const v of variation.variations) {
              if (v.sku === sku) {
                return v.id;
              }
            }
          }
        }
      }
      
      // If no variations found, use product ID as variation ID
      return prokipProduct.id;
    } catch (error) {
      console.error(`❌ Error getting variation ID for ${sku}:`, error.message);
      return null;
    }
  }

  /**
   * Deduct stock directly is disabled in /api/ecom mode.
   */
  async deductStockFromProkip() {
    throw new Error('Direct stock deduction disabled. Use /api/ecom/sync-orders.');
  }

  /**
   * Log stock transaction for tracking and reconciliation
   */
  async logStockTransaction(orderData, deductions, connectionId, result) {
    try {
      await prisma.stockTransaction.create({
        data: {
          connectionId: connectionId,
          wooOrderId: orderData.id.toString(),
          wooOrderNumber: orderData.order_number?.toString() || orderData.id.toString(),
          transactionType: 'stock_deduction',
          status: result.success ? 'success' : 'failed',
          itemCount: deductions.length,
          totalQuantity: deductions.reduce((sum, item) => sum + item.quantity, 0),
          prokipResponse: result.data,
          orderData: orderData,
          deductions: deductions,
          createdAt: new Date()
        }
      });
      
      console.log('📝 Stock transaction logged successfully');
    } catch (error) {
      console.error('❌ Failed to log stock transaction:', error.message);
    }
  }

  /**
   * Handle webhook from WooCommerce
   */
  async handleWooCommerceWebhook(webhookData, connectionId) {
    try {
      console.log('🪝 Received WooCommerce webhook:', webhookData);
      
      // Process different webhook types
      switch (webhookData.action) {
        case 'order.created':
        case 'order.updated':
        case 'order.completed':
          return await this.processOrder(webhookData.order || webhookData, connectionId);
        
        default:
          console.log(`⚠️ Unhandled webhook action: ${webhookData.action}`);
          return { success: true, message: 'Webhook received but not processed' };
      }
    } catch (error) {
      console.error('❌ Failed to handle WooCommerce webhook:', error.message);
      throw error;
    }
  }

  /**
   * Get stock transaction history
   */
  async getStockTransactionHistory(connectionId, limit = 50) {
    try {
      return await prisma.stockTransaction.findMany({
        where: { connectionId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          connection: {
            select: { storeName: true, platform: true }
          }
        }
      });
    } catch (error) {
      console.error('❌ Failed to get stock transaction history:', error.message);
      return [];
    }
  }

  /**
   * Reconcile stock between WooCommerce and Prokip
   */
  async reconcileStock(connectionId) {
    try {
      console.log('🔄 Starting stock reconciliation...');
      
      const connection = await prisma.connection.findUnique({
        where: { id: connectionId }
      });
      
      const prokipConfig = await prisma.prokipConfig.findFirst({
        where: { userId: connection.userId }
      });
      
      // Get WooCommerce products
      const wooProducts = await this.getWooCommerceProducts(connection);
      
      // Get Prokip stock levels
      const prokipStock = await this.getProkipStockLevels(prokipConfig);
      
      // Compare and identify discrepancies
      const discrepancies = this.identifyStockDiscrepancies(wooProducts, prokipStock);
      
      console.log(`📊 Found ${discrepancies.length} stock discrepancies`);
      
      return {
        success: true,
        discrepancies,
        wooProductsCount: wooProducts.length,
        prokipProductsCount: prokipStock.length
      };
      
    } catch (error) {
      console.error('❌ Stock reconciliation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get WooCommerce products
   */
  async getWooCommerceProducts(connection) {
    try {
      const { decryptCredentials } = require('./storeService');
      const { consumerKey, consumerSecret } = decryptCredentials(connection);
      
      const response = await axios.get(`${connection.storeUrl}/wp-json/wc/v3/products`, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        },
        params: {
          per_page: 100,
          status: 'publish'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get WooCommerce products:', error.message);
      return [];
    }
  }

  /**
   * Get Prokip stock levels
   */
  async getProkipStockLevels(prokipConfig) {
    try {
      const prokipService = require('./prokipService');
      const products = await prokipService.getProducts(null, prokipConfig.userId);
      
      return products.map(product => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        stock: this.calculateProductStock(product, prokipConfig.locationId)
      }));
    } catch (error) {
      console.error('❌ Failed to get Prokip stock levels:', error.message);
      return [];
    }
  }

  /**
   * Calculate product stock from variations
   */
  calculateProductStock(product, locationId) {
    let totalStock = 0;
    
    if (product.product_variations && product.product_variations.length > 0) {
      product.product_variations.forEach(variation => {
        if (variation.variations && variation.variations.length > 0) {
          variation.variations.forEach(v => {
            if (v.variation_location_details && v.variation_location_details.length > 0) {
              v.variation_location_details.forEach(location => {
                if (location.location_id == locationId) {
                  const qty = parseFloat(location.qty_available || 0);
                  totalStock += qty;
                }
              });
            }
          });
        }
      });
    }
    
    return totalStock;
  }

  /**
   * Identify stock discrepancies
   */
  identifyStockDiscrepancies(wooProducts, prokipStock) {
    const discrepancies = [];
    
    wooProducts.forEach(wooProduct => {
      const prokipProduct = prokipStock.find(p => p.sku === wooProduct.sku);
      
      if (prokipProduct) {
        const wooStock = parseInt(wooProduct.stock_quantity || 0);
        const prokipStockLevel = parseInt(prokipProduct.stock || 0);
        
        if (wooStock !== prokipStockLevel) {
          discrepancies.push({
            sku: wooProduct.sku,
            name: wooProduct.name,
            wooStock,
            prokipStock: prokipStockLevel,
            difference: wooStock - prokipStockLevel
          });
        }
      }
    });
    
    return discrepancies;
  }
}

module.exports = new WooCommerceToProkipService();
