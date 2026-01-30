const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function setupPublicWebhookUrl() {
  console.log('🌐 Setting Up Public Webhook URL');
  console.log('================================');

  try {
    // 1. Check current webhook URL
    console.log('\n1️⃣ Current webhook configuration...');
    const currentUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}/connections/webhook/woocommerce`;
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      console.log('❌ Webhook URL is using localhost - WooCommerce cannot reach this!');
      
      // 2. Create ngrok tunnel
      console.log('\n2️⃣ Setting up ngrok tunnel...');
      console.log('   Starting ngrok tunnel...');
      
      const { spawn } = require('child_process');
      const ngrok = spawn('ngrok', ['http', '3000'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let tunnelUrl = null;
      
      ngrok.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('📡 Ngrok:', output.trim());
        
        // Extract tunnel URL
        const match = output.match(/https:\/\/[a-z0-9-]+\.ngrok\.io/);
        if (match && !tunnelUrl) {
          tunnelUrl = match[0];
          console.log(`✅ Tunnel URL: ${tunnelUrl}`);
          
          // Update webhook URL
          const webhookUrl = `${tunnelUrl}/connections/webhook/woocommerce`;
          console.log(`🔗 New webhook URL: ${webhookUrl}`);
          
          // Update .env file
          updateEnvFile(webhookUrl);
        }
      });
      
      ngrok.stderr.on('data', (data) => {
        console.error('Ngrok error:', data.toString());
      });
      
      ngrok.on('close', (code) => {
        console.log(`Ngrok process exited with code ${code}`);
      });
      
      // Wait for tunnel to be established
      setTimeout(async () => {
        if (tunnelUrl) {
          console.log('\n3️⃣ Testing webhook accessibility...');
          try {
            const webhookUrl = `${tunnelUrl}/connections/webhook/woocommerce`;
            const response = await axios.get(webhookUrl, { 
              timeout: 5000,
              validateStatus: (status) => status < 500 
            });
            console.log(`✅ Webhook accessible (Status: ${response.status})`);
            
            console.log('\n4️⃣ Next steps:');
            console.log('1. Update your WooCommerce webhook configuration:');
            console.log(`   Webhook URL: ${webhookUrl}`);
            console.log('   Events: order.created, order.updated, order.status_changed');
            console.log('2. Test by creating a new order in WooCommerce');
            console.log('3. Check server logs for webhook receipt');
            
          } catch (error) {
            console.error('❌ Webhook not accessible:', error.message);
          }
        } else {
          console.log('❌ Failed to establish ngrok tunnel');
          console.log('\n💡 Manual setup:');
          console.log('1. Install ngrok: npm install -g ngrok');
          console.log('2. Run: ngrok http 3000');
          console.log('3. Copy the https://....ngrok.io URL');
          console.log('4. Update WEBHOOK_URL in .env');
          console.log('5. Restart the server');
        }
        
        // Keep ngrok running
        console.log('\n🔄 Ngrok tunnel is running. Press Ctrl+C to stop.');
      }, 5000);
      
    } else {
      console.log('✅ Webhook URL appears to be public');
      
      // Test accessibility
      console.log('\n2️⃣ Testing webhook accessibility...');
      try {
        const response = await axios.get(currentUrl, { 
          timeout: 5000,
          validateStatus: (status) => status < 500 
        });
        console.log(`✅ Webhook accessible (Status: ${response.status})`);
      } catch (error) {
        console.error('❌ Webhook not accessible:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

function updateEnvFile(newUrl) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update WEBHOOK_URL
    envContent = envContent.replace(
      /^WEBHOOK_URL=.*$/m,
      `WEBHOOK_URL=${newUrl}`
    );
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with new webhook URL');
  } catch (error) {
    console.error('❌ Failed to update .env:', error.message);
  }
}

// Run setup
setupPublicWebhookUrl();
