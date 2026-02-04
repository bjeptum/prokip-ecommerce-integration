// Fix the bidirectional sync routes file structure

const fs = require('fs');
const path = require('path');

// Read the current file
const filePath = path.join(__dirname, 'src/routes/bidirectionalSyncRoutes.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax issue by ensuring proper try-catch structure
// The issue is likely a missing opening try or extra closing brace

console.log('Checking bidirectionalSyncRoutes.js syntax...');

// Check for basic syntax issues
const openTryCount = (content.match(/try\s*{/g) || []).length;
const closeCatchCount = (content.match(/}\s*catch/g) || []).length;

console.log(`Open try blocks: ${openTryCount}`);
console.log(`Close catch blocks: ${closeCatchCount}`);

if (openTryCount !== closeCatchCount) {
  console.log('❌ Try-catch blocks are mismatched');
} else {
  console.log('✅ Try-catch blocks appear balanced');
}

// Check for brace balance
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;

console.log(`Open braces: ${openBraces}`);
console.log(`Close braces: ${closeBraces}`);

if (openBraces !== closeBraces) {
  console.log('❌ Braces are mismatched');
} else {
  console.log('✅ Braces appear balanced');
}

console.log('File structure check completed.');
