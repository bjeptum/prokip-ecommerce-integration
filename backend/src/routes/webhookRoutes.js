const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { processStoreToProkip } = require('../services/syncService');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Shopify webhook endpoint (public)
router.post('/shopify', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  const shop = req.headers['x-shopify-shop-domain'];

  const generatedHmac = crypto.createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(req.body)
    .digest('base64');

  if (generatedHmac !== hmac) return res.status(401).send('Invalid HMAC');

  const data = JSON.parse(req.body.toString());
  processStoreToProkip(shop, topic, data, 'shopify');

  res.status(200).send('OK');
});

// ENHANCED WooCommerce webhook endpoint
router.post('/woocommerce', express.json({ limit: '10mb' }), async (req, res) => {
  console.log('🔔 WooCommerce webhook received!');
  console.log('Topic:', req.headers['x-wc-webhook-topic']);
  console.log('Order ID:', req.body?.id);
  console.log('Order Status:', req.body?.status);
  console.log('Store URL:', req.headers['x-wc-webhook-source']);
  
  try {
    const signature = req.headers['x-wc-webhook-signature'];
    const topic = req.headers['x-wc-webhook-topic'] || 'order.created';
    const source = req.headers['x-wc-webhook-source'];
    
    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.WOO_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const generatedSignature = crypto.createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('base64');

      if (generatedSignature !== signature) {
        console.error('❌ Invalid signature for WooCommerce webhook');
        // Don't reject for now, just log and continue for debugging
      }
    }

    // Store webhook event for debugging
    let connection = null; // Declare connection in outer scope
    let connectionId = null;
    
    try {
      // Find connection for this store
      if (source) {
        connection = await prisma.connection.findFirst({
          where: { storeUrl: source }
        });
      }
      
      // If no connection found by source, try to find any WooCommerce connection
      if (!connection) {
        connection = await prisma.connection.findFirst({
          where: { platform: 'woocommerce' }
        });
      }
      
      if (connection) {
        connectionId = connection.id;
      } else {
        // Skip webhook event storage if no connection found
        console.log('⚠️ No connection found, skipping webhook event storage');
      }
      
      if (connectionId) {
        await prisma.webhookEvent.create({
          data: {
            connectionId,
            eventType: topic,
            payload: JSON.stringify(req.body),
            processed: false
          }
        });
        console.log('✅ Webhook event stored in database');
      }
    } catch (storeError) {
      console.log('⚠️ Could not store webhook event:', storeError.message);
    }
    
    // Find store URL with multiple fallbacks
    let storeUrl = source || req.body.resource?.site_url || req.body.site_url || 
                   req.body.meta?.store_url || req.body.domain || 
                   'https://learn.prokip.africa/';
    
    // If still no store URL, try to extract from order data
    if (!storeUrl && req.body.id) {
      storeUrl = req.body._links?.self?.[0]?.href ? 
        new URL(req.body._links.self[0].href).origin : 'https://learn.prokip.africa/';
    }
    
    console.log(`🎯 Processing webhook for store: ${storeUrl}`);
    
    // Process webhook asynchronously to avoid timeout
    setImmediate(async () => {
      try {
        console.log('🔄 Starting webhook processing...');
        
        // Get userId from connection (re-find if needed)
        let userId = null;
        let processingConnection = connection;
        
        if (!processingConnection) {
          // Re-find connection for processing
          if (source) {
            processingConnection = await prisma.connection.findFirst({
              where: { storeUrl: source }
            });
          }
          
          if (!processingConnection) {
            processingConnection = await prisma.connection.findFirst({
              where: { platform: 'woocommerce' }
            });
          }
        }
        
        if (processingConnection) {
          userId = processingConnection.userId;
        }
        
        await processStoreToProkip(storeUrl, topic, req.body, 'woocommerce', userId);
        console.log('✅ Webhook processed successfully');
        
        // Mark webhook as processed
        try {
          await prisma.webhookEvent.updateMany({
            where: { 
              eventType: topic,
              processed: false
            },
            data: { processed: true, processedAt: new Date() }
          });
        } catch (updateError) {
          console.log('⚠️ Could not update webhook event:', updateError.message);
        }
        
      } catch (processError) {
        console.error('❌ Webhook processing failed:', processError.message);
        console.error('Stack:', processError.stack);
        
        // Store error for debugging
        try {
          let errorConnectionId = null;
          let errorConnection = null;
          
          if (source) {
            errorConnection = await prisma.connection.findFirst({
              where: { storeUrl: source }
            });
          }
          
          if (!errorConnection) {
            errorConnection = await prisma.connection.findFirst({
              where: { platform: 'woocommerce' }
            });
          }
          
          if (errorConnection) {
            errorConnectionId = errorConnection.id;
          }
          
          if (errorConnectionId) {
            await prisma.syncError.create({
              data: {
                connectionId: errorConnectionId,
                errorType: 'webhook_processing',
                errorMessage: processError.message,
                errorDetails: JSON.stringify({ 
                  topic, 
                  orderId: req.body?.id,
                  storeUrl 
                })
              }
            });
          }
        } catch (errorStoreError) {
          console.log('⚠️ Could not store error:', errorStoreError.message);
        }
      }
    });

    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Webhook handling error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).send('Error processing webhook');
  }
});

module.exports = router;

