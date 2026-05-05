import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { resolve } from 'path';

// Simple .env parser
const envFile = fs.readFileSync(resolve(process.cwd(), '.env'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.includes('='))
    .map(line => line.split('='))
);

const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseKey = env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = 'admin@wrc.com';
  const password = 'adminadmin'; // password must be at least 6 characters
  const username = 'admin';

  console.log(`Attempting to create admin user: ${email}...`);

  // Try to sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        role: 'admin'
      }
    }
  });

  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      console.log('User already exists, attempting to sign in...');
    } else {
      console.error('Error during signup:', signUpError.message);
      return;
    }
  }

  // Try to sign in to confirm it works
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Error during signin:', signInError.message);
    return;
  }

  console.log('Admin user ready!');
  console.log('User ID:', signInData.user.id);
  
  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: signInData.user.id,
      email,
      username,
      role: 'admin',
      is_admin: true
    });

  if (profileError) {
    console.error('Error creating profile:', profileError.message);
  } else {
    console.log('Admin profile created successfully!');
  }
}

createAdmin();
