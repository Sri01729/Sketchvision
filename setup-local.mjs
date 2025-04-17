import fs from 'fs';
import { execSync } from 'child_process';

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const lines = envFile.split('\n');

    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          env[key.trim()] = value.trim();
          process.env[key.trim()] = value.trim();
        }
      }
    }
    return env;
  } catch (error) {
    console.error('Error loading .env.local file:', error.message);
    return {};
  }
}

async function setupLocalDevelopment() {
  console.log('🔧 Setting up local development environment...');

  // Load environment variables
  const env = loadEnv();

  // Verify OpenAI API key
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'your_personal_openai_api_key_here') {
    console.error('⚠️ Please set your OpenAI API key in .env.local file');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found');

  // Set up Convex environment variables for local development
  try {
    console.log('📝 Setting up Convex environment variables...');
    execSync('npx convex env set OPENAI_API_KEY --local', {
      stdio: 'inherit',
      env: { ...process.env, OPENAI_API_KEY: env.OPENAI_API_KEY }
    });
    console.log('✅ Successfully set up Convex environment variables');

    console.log('\n🎉 Setup complete! You can now run:');
    console.log('  npm run dev:frontend    - Run just the frontend');
    console.log('  npm run dev:backend     - Run just the Convex backend');
    console.log('  npm run dev             - Run both frontend and backend');

  } catch (error) {
    console.error('❌ Error setting up Convex environment:', error.message);
    console.log('\n🚧 You can still run the frontend with:');
    console.log('  npm run frontend-only');
  }
}

setupLocalDevelopment();