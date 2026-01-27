const fs = require('fs');
const path = require('path');

// Fix the bidirectional sync to properly handle stock deduction
const syncFilePath = path.join(__dirname, 'src', 'routes', 'bidirectionalSyncRoutes.js');

console.log('🔧 Fixing bidirectional sync stock deduction logic...');

// Read the current file
let content = fs.readFileSync(syncFilePath, 'utf8');

// The fix: Instead of only deducting from current Prokip stock (which is 0),
// we should deduct from the local inventory log and sync that to Prokip
const oldLogic = `              const currentStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
              const quantityToDeduct = Math.min(product.quantity, currentStock);
              
              console.log(\`  📊 Product \${product.sku}: Current stock: \${currentStock}, Deducting: \${quantityToDeduct}\`);

              if (quantityToDeduct > 0) {`;

const newLogic = `              const currentStock = stockResponse.data?.[0]?.stock || stockResponse.data?.[0]?.qty_available || 0;
              
              // IMPORTANT: Use local inventory stock as the source of truth, not Prokip stock
              // Prokip stock may be 0 due to API limitations, but local inventory has the real count
              const localInventoryLog = await prisma.inventoryLog.findFirst({
                where: {
                  connectionId: wooConnection.id,
                  sku: product.sku
                }
              });
              
              const localStock = localInventoryLog?.quantity || 0;
              const quantityToDeduct = Math.min(product.quantity, localStock);
              
              console.log(\`  📊 Product \${product.sku}: Local stock: \${localStock}, Prokip stock: \${currentStock}, Deducting: \${quantityToDeduct}\`);

              if (quantityToDeduct > 0) {`;

// Replace the logic
if (content.includes(oldLogic)) {
  content = content.replace(oldLogic, newLogic);
  console.log('✅ Updated stock deduction logic to use local inventory');
} else {
  console.log('❌ Could not find the exact logic to replace');
  process.exit(1);
}

// Also need to update the inventory log update logic to use local stock
const oldUpdateLogic = `                if (inventoryLog) {
                  const newStock = Math.max(0, inventoryLog.quantity - quantityToDeduct);
                  await prisma.inventoryLog.update({
                    where: { id: inventoryLog.id },
                    data: {
                      quantity: newStock,
                      lastSynced: new Date()
                    }
                  });
                  console.log(\`  ✅ Updated inventory log: \${inventoryLog.quantity} → \${newStock}\`);
                } else {
                  await prisma.inventoryLog.create({
                    data: {
                      connectionId: wooConnection.id,
                      productId: product.product_id.toString(),
                      productName: product.name,
                      sku: product.sku,
                      quantity: Math.max(0, currentStock - quantityToDeduct),
                      price: product.unit_price
                    }
                  });
                  console.log(\`  ✅ Created inventory log with stock: \${Math.max(0, currentStock - quantityToDeduct)}\`);
                }`;

const newUpdateLogic = `                if (inventoryLog) {
                  const newStock = Math.max(0, inventoryLog.quantity - quantityToDeduct);
                  await prisma.inventoryLog.update({
                    where: { id: inventoryLog.id },
                    data: {
                      quantity: newStock,
                      lastSynced: new Date()
                    }
                  });
                  console.log(\`  ✅ Updated inventory log: \${inventoryLog.quantity} → \${newStock}\`);
                } else {
                  // Create new inventory log with the remaining stock
                  await prisma.inventoryLog.create({
                    data: {
                      connectionId: wooConnection.id,
                      productId: product.product_id.toString(),
                      productName: product.name,
                      sku: product.sku,
                      quantity: Math.max(0, localStock - quantityToDeduct),
                      price: product.unit_price
                    }
                  });
                  console.log(\`  ✅ Created inventory log with stock: \${Math.max(0, localStock - quantityToDeduct)}\`);
                }`;

// Replace the update logic
if (content.includes(oldUpdateLogic)) {
  content = content.replace(oldUpdateLogic, newUpdateLogic);
  console.log('✅ Updated inventory log update logic');
} else {
  console.log('❌ Could not find the update logic to replace');
  process.exit(1);
}

// Write the fixed file back
fs.writeFileSync(syncFilePath, content, 'utf8');

console.log('🎉 Bidirectional sync fixed successfully!');
console.log('');
console.log('📋 Summary of changes:');
console.log('  ✅ Stock deduction now uses local inventory as source of truth');
console.log('  ✅ Local inventory is properly decremented when orders are processed');
console.log('  ✅ Sync will work even when Prokip stock is 0');
console.log('');
console.log('🔄 The sync will now properly deduct stock from your local inventory');
console.log('   when WooCommerce orders are processed, regardless of Prokip API stock levels.');
