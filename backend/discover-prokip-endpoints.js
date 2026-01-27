const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function discoverProkipEndpoints() {
  try {
    console.log('🔍 Discovering available Prokip API endpoints...');
    
    // Get Prokip config
    const prokipConfig = await prisma.prokipConfig.findFirst();
    if (!prokipConfig) {
      console.error('❌ Prokip config not found');
      return;
    }
    
    const prokipHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${prokipConfig.token}`,
      Accept: 'application/json'
    };
    
    const baseUrl = 'https://api.prokip.africa/connector/api';
    
    // Test common endpoints
    const endpoints = [
      '/product',
      '/sell',
      '/purchase',
      '/stock',
      '/inventory',
      '/product-stock',
      '/stock-adjustment',
      '/adjustment',
      '/transaction',
      '/product/{id}/stock',
      '/product/{id}/adjust'
    ];
    
    console.log('🧪 Testing endpoints...');
    
    for (const endpoint of endpoints) {
      try {
        const url = endpoint.includes('{id}') 
          ? `${baseUrl}/product/123456/stock`  // Test with a dummy ID
          : `${baseUrl}${endpoint}`;
        
        console.log(`📡 Testing: ${url}`);
        
        const response = await axios.get(url, { 
          headers: prokipHeaders,
          timeout: 5000
        });
        
        console.log(`  ✅ ${endpoint} - ${response.status} (${response.statusText})`);
        
      } catch (error) {
        if (error.response) {
          console.log(`  ❌ ${endpoint} - ${error.response.status} (${error.response.statusText})`);
        } else {
          console.log(`  ❌ ${endpoint} - Network error: ${error.message}`);
        }
      }
    }
    
    // Check what endpoints are documented in existing code
    console.log('\n📚 Checking documented endpoints in existing code...');
    
    const fs = require('fs');
    const path = require('path');
    
    function searchInFile(filePath, searchTerm) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.includes(searchTerm);
      } catch (error) {
        return false;
      }
    }
    
    const backendDir = './src';
    const apiTerms = [
      'api.prokip.africa',
      '/connector/api/',
      'product-stock-report',
      '/sell',
      '/purchase'
    ];
    
    function scanDirectory(dir) {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (file.endsWith('.js')) {
          console.log(`\n📄 Checking: ${fullPath}`);
          
          for (const term of apiTerms) {
            if (searchInFile(fullPath, term)) {
              console.log(`  🔍 Found: ${term}`);
            }
          }
        }
      }
    }
    
    if (fs.existsSync(backendDir)) {
      scanDirectory(backendDir);
    }
    
  } catch (error) {
    console.error('❌ Discovery error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

discoverProkipEndpoints();
