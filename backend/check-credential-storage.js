const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function checkCredentialStorage() {
  try {
    console.log('🔍 CHECKING: How WooCommerce credentials are stored');
    console.log('=' .repeat(60));
    
    // Get the connection
    const wooConnection = await prisma.connection.findFirst({ where: { platform: 'woocommerce' } });
    
    if (!wooConnection) {
      console.log('❌ No WooCommerce connection found');
      return;
    }
    
    console.log(`🌐 Store URL: ${wooConnection.storeUrl}`);
    console.log(`🔑 Consumer Key (raw):`, wooConnection.consumerKey);
    console.log(`🔐 Consumer Secret (raw):`, wooConnection.consumerSecret);
    
    // Check if they're encrypted
    const keyIsEncrypted = typeof wooConnection.consumerKey === 'object' && wooConnection.consumerKey.encrypted;
    const secretIsEncrypted = typeof wooConnection.consumerSecret === 'object' && wooConnection.consumerSecret.encrypted;
    
    console.log(`🔒 Consumer Key is encrypted: ${keyIsEncrypted}`);
    console.log(`🔒 Consumer Secret is encrypted: ${secretIsEncrypted}`);
    
    if (keyIsEncrypted) {
      console.log('\n🔓 ATTEMPTING TO DECRYPT CREDENTIALS:');
      console.log('-'.repeat(40));
      
      // Try to decrypt (this might not work without the encryption key)
      try {
        const encryptionKey = process.env.ENCRYPTION_KEY || 'your-encryption-key-here';
        
        const decrypt = (encryptedData) => {
          if (typeof encryptedData === 'string') return encryptedData;
          if (!encryptedData || !encryptedData.encrypted) return '';
          
          try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey), Buffer.from(encryptedData.iv, 'hex'));
            decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
          } catch (error) {
            console.log('❌ Decryption failed:', error.message);
            return '';
          }
        };
        
        const decryptedKey = decrypt(wooConnection.consumerKey);
        const decryptedSecret = decrypt(wooConnection.consumerSecret);
        
        console.log(`🔑 Decrypted Consumer Key: ${decryptedKey ? 'Success' : 'Failed'}`);
        console.log(`🔐 Decrypted Consumer Secret: ${decryptedSecret ? 'Success' : 'Failed'}`);
        
        if (decryptedKey && decryptedSecret) {
          console.log('\n🧪 TESTING DECRYPTED CREDENTIALS:');
          console.log('-'.repeat(40));
          
          const testHeaders = {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${decryptedKey}:${decryptedSecret}`).toString('base64')}`
          };
          
          try {
            const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
            console.log('✅ Decrypted credentials work!');
            
            // Update database with decrypted credentials
            await prisma.connection.update({
              where: { id: wooConnection.id },
              data: {
                consumerKey: decryptedKey,
                consumerSecret: decryptedSecret
              }
            });
            
            console.log('✅ Database updated with decrypted credentials!');
            
            // Test sync
            console.log('\n🔄 Testing sync with working credentials...');
            const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
              headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('✅ Sync response:', syncResponse.data);
            
          } catch (error) {
            console.log('❌ Decrypted credentials failed:', error.response?.status);
          }
        }
        
      } catch (error) {
        console.log('❌ Decryption process failed:', error.message);
      }
    }
    
    // If we can't decrypt, let's try to update with known working credentials
    if (!keyIsEncrypted && !secretIsEncrypted) {
      console.log('\n🔧 CREDENTIALS ARE NOT ENCRYPTED - TESTING DIRECTLY:');
      console.log('-'.repeat(40));
      
      const testHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${wooConnection.consumerKey}:${wooConnection.consumerSecret}`).toString('base64')}`
      };
      
      try {
        const testResponse = await axios.get(`${wooConnection.storeUrl}/wp-json/wc/v3/system_status`, { headers: testHeaders });
        console.log('✅ Direct credentials work!');
        
        // Test sync
        console.log('\n🔄 Testing sync...');
        const syncResponse = await axios.post('http://localhost:3000/bidirectional-sync/sync-woocommerce', {}, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Sync response:', syncResponse.data);
        
      } catch (error) {
        console.log('❌ Direct credentials failed:', error.response?.status);
        console.log('💡 The credentials in the database are invalid');
        
        console.log('\n🔧 SOLUTION: Update with working credentials');
        console.log('Please provide your working WooCommerce API credentials:');
        console.log('1. Consumer Key (starts with ck_)');
        console.log('2. Consumer Secret (starts with cs_)');
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    console.log('1. If credentials are encrypted, we need the encryption key');
    console.log('2. If credentials are plain text but invalid, update them');
    console.log('3. Ensure WooCommerce API has Read/Write permissions');
    console.log('4. Verify the store URL is correct');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCredentialStorage();
