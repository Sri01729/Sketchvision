import fs from 'fs';
import { OpenAI } from 'openai';

// Manual environment loading from .env.local
function loadEnv() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const lines = envFile.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
    console.log('📂 Loaded environment variables from .env.local');
  } catch (error) {
    console.error('Error loading .env.local file:', error.message);
  }
}

async function testOpenAI() {
  // Load environment variables
  loadEnv();

  // Check if API key is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('⚠️ OpenAI API key is not set in .env.local file');
    process.exit(1);
  }

  if (apiKey === 'your_personal_openai_api_key_here') {
    console.error('⚠️ You need to replace "your_personal_openai_api_key_here" with your actual OpenAI API key');
    process.exit(1);
  }

  console.log('🔑 OpenAI API key found');

  try {
    const openai = new OpenAI({ apiKey });

    // Test GPT API
    console.log('🧠 Testing GPT API...');
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Generate a short prompt for a beach scene" }
      ],
    });
    console.log('✅ GPT API test successful!');
    console.log('📝 Example prompt:', chatCompletion.choices[0].message.content);

    // Test DALL-E API (this will use credits!)
    console.log('\n🖼️ Do you want to test DALL-E image generation? This will use API credits.');
    console.log('   To test, run this script with: node test-openai.mjs dalle-test');

    if (process.argv.includes('dalle-test')) {
      console.log('🎨 Testing DALL-E API...');
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: "A simple small sketch of a cat",
        n: 1,
        size: "1024x1024",
      });
      console.log('✅ DALL-E API test successful!');
      console.log('🔗 Generated image URL:', imageResponse.data[0].url);
    }

  } catch (error) {
    console.error('❌ OpenAI API test failed:');
    console.error(error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testOpenAI();