import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser to avoid dependency on dotenv
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = 'admin@wrc.com';
  const password = 'admin2026'; // Supabase requires min 6 characters
  
  console.log(`Attempting to create admin user: ${email}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
        data: {
            username: 'admin',
            role: 'admin'
        }
    }
  });

  if (error) {
    if (error.message.includes('already registered')) {
        console.log('Admin user already exists.');
    } else {
        console.error('Error creating admin:', error.message);
    }
  } else {
    console.log('Admin user created successfully:', data.user.email);
    
    // Also try to upsert into profiles if needed, though auth.js should handle it on first login.
    // But we can do it here too if we want to be sure.
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: data.user.id,
            email: email,
            username: 'admin',
            role: 'admin',
            is_admin: true
        });
    
    if (profileError) {
        console.error('Error creating admin profile:', profileError.message);
    } else {
        console.log('Admin profile created successfully.');
    }
  }
}

createAdmin();
