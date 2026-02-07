// Script to copy Firebase credentials from backend/.env to frontend/.env.local
const fs = require('fs');
const path = require('path');

const backendEnvPath = path.join(__dirname, '../backend/.env');
const frontendEnvPath = path.join(__dirname, '../.env.local');

console.log('🔧 Copying Firebase credentials...\n');

// Read backend .env
if (!fs.existsSync(backendEnvPath)) {
  console.error('❌ backend/.env not found!');
  process.exit(1);
}

const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
const lines = backendEnv.split('\n');

// Extract Firebase variables
const firebaseVars = lines.filter(line => 
  line.includes('NEXT_PUBLIC_FIREBASE_') || 
  line.includes('FIREBASE_')
);

if (firebaseVars.length === 0) {
  console.error('❌ No Firebase credentials found in backend/.env');
  process.exit(1);
}

// Read existing frontend .env.local (if exists)
let frontendEnv = '';
if (fs.existsSync(frontendEnvPath)) {
  frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  console.log('✓ Found existing .env.local file');
}

// Add Firebase variables if not already present
firebaseVars.forEach(varLine => {
  const varName = varLine.split('=')[0].trim();
  if (varName && !frontendEnv.includes(varName) && varLine.trim()) {
    frontendEnv += (frontendEnv.endsWith('\n') ? '' : '\n') + varLine + '\n';
    console.log(`✓ Added: ${varName}`);
  } else if (varName && varLine.trim()) {
    console.log(`⚠ Already exists: ${varName}`);
  }
});

// Write to frontend .env.local
fs.writeFileSync(frontendEnvPath, frontendEnv);

console.log('\n✅ Firebase credentials copied to .env.local');
console.log('\n⚠️  IMPORTANT: Restart your dev server for changes to take effect!');
console.log('   1. Press Ctrl+C to stop the server');
console.log('   2. Run: npm run dev');
console.log('   3. Refresh your browser\n');
