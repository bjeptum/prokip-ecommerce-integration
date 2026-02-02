/**
 * WOOCOMMERCE WEBHOOK ROUTES - UPDATED FOR PROKIP ECOMMERCE API
 * Handles WooCommerce webhooks and syncs orders to Prokip
 */

const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const prokipEcomService = require('../services/prokipEcomService');
const wooToProkipMapper = require('../services/wooToProkipMapper');

const router = express.Router();

/**
 * WooCommerce webhook endpoint for order creation
 * URL: POST /webhooks/woocommerce/order-created
 */
router.post('/woocommerce/order-created', async (req, res) => {
  try {
    console.log('🪝 Received WooCommerce order-created webhook');
    
    const webhookData = req.body;
    const order = webhookData.order || webhookData;
    
    if (!order) {
      return res.status(400).json({ error: 'No order data found in webhook' });
    }

    console.log(`📦 Processing order: ${order.id} (${order.order_number})`);
    console.log(`📊 Order status: ${order.status}`);

    // Get connection ID from webhook or use default
    const connectionId = req.headers['x-connection-id'] || 10;
    
    // Get connection details
    const connection = await prisma.connection.findUnique({
      where: { id: parseInt(connectionId) }
    });

    if (!connection) {
      console.error(`❌ Connection ${connectionId} not found`);
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Verify webhook signature if provided
    const signature = req.headers['x-wc-webhook-signature'];
    if (signature && connection.webhookSecret) {
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', connection.webhookSecret)
        .update(body)
        .digest('base64');

      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Check if order should be synced
    if (!wooToProkipMapper.shouldSyncOrder(order)) {
      console.log(`⏭️ Order ${order.id} does not require sync`);
      return res.status(200).json({ 
        success: true, 
        message: 'Order does not require sync',
        orderId: order.id 
      });
    }

    // Check if order was already synced (idempotency)
    const wooOrderId = order.id.toString();
    const isAlreadySynced = await prokipEcomService.isOrderAlreadySynced(wooOrderId, parseInt(connectionId));
    
    if (isAlreadySynced) {
      console.log(`⏭️ Order ${wooOrderId} already synced to Prokip`);
      return res.status(200).json({ 
        success: true, 
        message: 'Order already synced',
        orderId: wooOrderId 
      });
    }

    // Map WooCommerce order to Prokip format
    const prokipOrder = wooToProkipMapper.mapOrderToProkip(order, connection);
    
    // Validate for Laravel controller requirements
    const validation = wooToProkipMapper.validateForLaravel(prokipOrder);
    if (!validation.isValid) {
      console.error(`❌ Laravel validation failed:`, validation.errors);
      await prokipEcomService.logTransaction({
        connectionId: parseInt(connectionId),
        wooOrderId: wooOrderId,
        wooOrderNumber: order.order_number || order.id,
        transactionType: 'order_sync',
        status: 'failed',
        itemCount: order.line_items?.length || 0,
        totalQuantity: order.line_items?.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0) || 0,
        errorMessage: `Laravel validation failed: ${validation.errors.join(', ')}`,
        orderData: order,
        prokipResponse: null
      });
      
      return res.status(400).json({ 
        error: 'Laravel validation failed', 
        details: validation.errors 
      });
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.log(`⚠️ Order warnings:`, validation.warnings);
    }

    // Send order to Prokip
    try {
      const prokipResponse = await prokipEcomService.sendOrderToProkip(prokipOrder, connection);
      
      // Log successful transaction
      await prokipEcomService.logTransaction({
        connectionId: parseInt(connectionId),
        wooOrderId: wooOrderId,
        wooOrderNumber: order.order_number || order.id,
        transactionType: 'order_sync',
        status: 'success',
        itemCount: order.line_items?.length || 0,
        totalQuantity: order.line_items?.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0) || 0,
        prokipResponse: prokipResponse.data,
        orderData: order,
        deductions: prokipOrder.products
      });

      console.log(`✅ Order ${wooOrderId} synced to Prokip successfully`);
      
      res.status(200).json({
        success: true,
        message: 'Order synced to Prokip successfully',
        orderId: wooOrderId,
        prokipResponse: prokipResponse.data
      });

    } catch (prokipError) {
      console.error(`❌ Failed to sync order to Prokip:`, prokipError.message);
      
      // Log failed transaction
      await prokipEcomService.logTransaction({
        connectionId: parseInt(connectionId),
        wooOrderId: wooOrderId,
        wooOrderNumber: order.order_number || order.id,
        transactionType: 'order_sync',
        status: 'failed',
        itemCount: order.line_items?.length || 0,
        totalQuantity: order.line_items?.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0) || 0,
        errorMessage: prokipError.message,
        orderData: order,
        prokipResponse: prokipError.response?.data || null
      });

      res.status(500).json({
        error: 'Failed to sync order to Prokip',
        details: prokipError.message,
        orderId: wooOrderId
      });
    }

  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

/**
 * Manual order sync endpoint for testing
 */
router.post('/woocommerce/manual-sync/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { order } = req.body;

    if (!order) {
      return res.status(400).json({ error: 'Order data is required' });
    }

    console.log(`🔧 Manual sync for order ${order.id} to connection ${connectionId}`);

    // Get connection details
    const connection = await prisma.connection.findUnique({
      where: { id: parseInt(connectionId) }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Map and send order to Prokip
    const prokipOrder = wooToProkipMapper.mapOrderToProkip(order, connection);
    const validation = wooToProkipMapper.validateForLaravel(prokipOrder);
    
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Laravel validation failed', 
        details: validation.errors 
      });
    }

    const prokipResponse = await prokipEcomService.sendOrderToProkip(prokipOrder, connection);

    res.json({
      success: true,
      message: 'Order synced manually to Prokip',
      orderId: order.id,
      prokipResponse: prokipResponse.data
    });

  } catch (error) {
    console.error('❌ Manual sync failed:', error.message);
    res.status(500).json({ 
      error: 'Manual sync failed', 
      details: error.message 
    });
  }
});

/**
 * Get transaction history
 */
router.get('/woocommerce/transactions/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { limit = 50, status } = req.query;

    const transactions = await prokipEcomService.getTransactionHistory(
      parseInt(connectionId),
      { limit: parseInt(limit), status, type: 'order_sync' }
    );

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });

  } catch (error) {
    console.error('❌ Failed to get transactions:', error.message);
    res.status(500).json({ 
      error: 'Failed to get transactions', 
      details: error.message 
    });
  }
});

/**
 * Test Prokip E-commerce API connection
 */
router.get('/woocommerce/test-connection/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection details
    const connection = await prisma.connection.findUnique({
      where: { id: parseInt(connectionId) }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Test connection
    const isConnected = await prokipEcomService.testConnection();

    res.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Prokip E-commerce API is accessible' : 'Prokip E-commerce API is not accessible'
    });

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    res.status(500).json({ 
      error: 'Connection test failed', 
      details: error.message 
    });
  }
});

module.exports = router;
