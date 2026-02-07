const fs = require('fs');
const path = require('path');

console.log('🔐 Setting up Admin Password...\n');

const envLocalPath = path.resolve(__dirname, '../.env.local');

// Check if .env.local exists
let envContent = '';
if (fs.existsSync(envLocalPath)) {
  envContent = fs.readFileSync(envLocalPath, 'utf8');
  console.log('✓ Found existing .env.local file');
} else {
  console.log('✓ Creating new .env.local file');
}

// Check if ADMIN_PASSWORD already exists
if (envContent.includes('ADMIN_PASSWORD=')) {
  console.log('✓ ADMIN_PASSWORD already configured in .env.local');
  console.log('\n📝 Current password is set. To change it:');
  console.log('   1. Edit .env.local');
  console.log('   2. Find line: ADMIN_PASSWORD=...');
  console.log('   3. Change the value');
  console.log('   4. Restart dev server\n');
} else {
  // Add ADMIN_PASSWORD
  if (envContent && !envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += '\n# Admin Dashboard Password\nADMIN_PASSWORD=madina2026\n';
  
  fs.writeFileSync(envLocalPath, envContent);
  
  console.log('✅ Added ADMIN_PASSWORD to .env.local');
  console.log('\n📝 Default Password: madina2026');
  console.log('\n⚠️  IMPORTANT: Restart your dev server for changes to take effect!');
  console.log('   1. Press Ctrl+C to stop the server');
  console.log('   2. Run: npm run dev');
  console.log('   3. Go to: http://localhost:3000/admin\n');
  console.log('🔒 To change password: Edit ADMIN_PASSWORD in .env.local\n');
}
