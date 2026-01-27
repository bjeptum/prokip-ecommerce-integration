/**
 * Fix webhook configuration and test webhook delivery
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function fixWebhooks() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Fixing webhook configuration...\n');

    // Get WooCommerce connection
    const wooConnection = await prisma.connection.findFirst({ 
      where: { platform: 'woocommerce' } 
    });

    if (!wooConnection) {
      console.error('❌ No WooCommerce connection found');
      return;
    }

    // Decrypt credentials
    const crypto = require('crypto');
    let consumerKey, consumerSecret;
    
    try {
      const key = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY || 'default-key');
      consumerKey = key.update(wooConnection.consumerKey, 'hex', 'utf8') + key.final('utf8');
      
      const secret = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY || 'default-key');
      consumerSecret = secret.update(wooConnection.consumerSecret, 'hex', 'utf8') + secret.final('utf8');
    } catch (error) {
      console.log('⚠️ Could not decrypt credentials, using as-is');
      consumerKey = wooConnection.consumerKey;
      consumerSecret = wooConnection.consumerSecret;
    }

    const wooHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    };

    // Get public URL for webhooks
    const publicUrl = process.env.PUBLIC_URL || 'https://your-domain.com'; // Replace with actual public URL
    const webhookUrl = `${publicUrl}/webhooks/woocommerce`;

    console.log(`📡 Setting up webhook: ${webhookUrl}`);

    // Delete existing webhooks
    try {
      const existingWebhooks = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/webhooks`, { headers: wooHeaders });
      
      for (const webhook of existingWebhooks.data) {
        if (webhook.delivery_url.includes('/webhooks/woocommerce')) {
          await axios.delete(`${wooConnection.storeUrl}/wp-json/wc/v3/webhooks/${webhook.id}`, { headers: wooHeaders });
          console.log(`🗑️ Deleted existing webhook: ${webhook.id}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Could not fetch existing webhooks');
    }

    // Create new webhooks for key events
    const webhookEvents = [
      'order.created',
      'order.updated',
      'order.paid'
    ];

    for (const topic of webhookEvents) {
      try {
        const webhookData = {
          name: `Prokip Sync - ${topic}`,
          topic: topic,
          delivery_url: webhookUrl,
          secret: process.env.WEBHOOK_SECRET || 'prokip-webhook-secret',
          status: 'active'
        };

        const response = await axios.post(`${wooConnection.storeUrl}/wp-json/wc/v3/webhooks`, webhookData, { headers: wooHeaders });
        console.log(`✅ Created webhook for ${topic}: ${response.data.id}`);
      } catch (error) {
        console.error(`❌ Failed to create webhook for ${topic}:`, error.response?.data || error.message);
      }
    }

    // Test webhook delivery
    console.log('\n🧪 Testing webhook delivery...');
    const testPayload = {
      id: 999999,
      order_number: 'TEST-999999',
      status: 'completed',
      total: '100.00',
      created_at: new Date().toISOString(),
      customer: { first_name: 'Test', email: 'test@example.com' },
      line_items: [
        { id: 1, name: 'Test Product', sku: 'TEST-SKU', quantity: 1, price: '100.00', total: '100.00' }
      ]
    };

    try {
      const testResponse = await axios.post(webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-wc-webhook-topic': 'order.created',
          'x-wc-webhook-signature': require('crypto')
            .createHmac('sha256', process.env.WEBHOOK_SECRET || 'prokip-webhook-secret')
            .update(JSON.stringify(testPayload))
            .digest('base64')
        }
      });
      
      console.log('✅ Webhook test delivered successfully');
    } catch (error) {
      console.error('❌ Webhook test failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Webhook setup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixWebhooks();
