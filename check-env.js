#!/usr/bin/env node

/**
 * Simple script to check if required environment variables are configured
 * Run with: node check-env.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

console.log('🔍 Checking Elsebrew environment configuration...\n');

// Check if .env.local exists
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found!');
  console.log('📝 Run: cp .env.example .env.local');
  console.log('   Then edit .env.local with your API keys\n');
  process.exit(1);
}

// Read .env.local
const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

const requiredVars = [
  { key: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', name: 'Google Maps API Key (client)' },
  { key: 'GOOGLE_MAPS_API_KEY', name: 'Google Maps API Key (server)' },
  { key: 'NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID', name: 'Google OAuth Client ID' },
  { key: 'OPENAI_API_KEY', name: 'OpenAI API Key' },
];

const optionalVars = [
  { key: 'NEXT_PUBLIC_GA4_MEASUREMENT_ID', name: 'Google Analytics 4 (optional)' },
  { key: 'NEXT_PUBLIC_BUYMEACOFFEE_URL', name: 'Buy Me A Coffee URL (optional)' },
  { key: 'MAILCHIMP_FORM_ACTION', name: 'Mailchimp Form Action (optional)' },
];

let allGood = true;

// Check required vars
console.log('📋 Required Environment Variables:');
requiredVars.forEach(({ key, name }) => {
  const line = lines.find(l => l.startsWith(key));
  if (!line) {
    console.log(`   ❌ ${name} - NOT FOUND`);
    allGood = false;
  } else {
    const value = line.split('=')[1]?.trim();
    if (!value || value.includes('YOUR_') || value.includes('sk-...')) {
      console.log(`   ⚠️  ${name} - NOT CONFIGURED`);
      allGood = false;
    } else {
      const preview = value.substring(0, 20) + (value.length > 20 ? '...' : '');
      console.log(`   ✅ ${name} - ${preview}`);
    }
  }
});

// Check optional vars
console.log('\n📋 Optional Environment Variables:');
optionalVars.forEach(({ key, name }) => {
  const line = lines.find(l => l.startsWith(key));
  if (!line) {
    console.log(`   ⚪ ${name} - Not set`);
  } else {
    const value = line.split('=')[1]?.trim();
    if (!value || value.includes('XXXXX') || value.includes('yourname')) {
      console.log(`   ⚪ ${name} - Not configured`);
    } else {
      const preview = value.substring(0, 30) + (value.length > 30 ? '...' : '');
      console.log(`   ✅ ${name} - ${preview}`);
    }
  }
});

console.log('\n' + '='.repeat(60));

if (allGood) {
  console.log('✅ All required environment variables are configured!');
  console.log('🚀 You can now run: npm run dev');
} else {
  console.log('❌ Some required environment variables are missing.');
  console.log('📖 See SETUP_GUIDE.md for detailed setup instructions.');
  process.exit(1);
}

console.log('='.repeat(60) + '\n');
