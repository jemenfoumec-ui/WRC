/**
 * WRC 2026 - Admin Account Setup Script
 * Run this script to create/verify the admin account in Supabase
 * 
 * Usage: node scripts/setup-admin.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env file not found. Please create one from .env.example');
        process.exit(1);
    }
    
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
            env[key.trim()] = valueParts.join('=').trim();
        }
    });
    
    return env;
}

async function setupAdmin() {
    console.log('🚀 WRC 2026 - Admin Account Setup\n');
    
    const env = loadEnv();
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase configuration in .env');
        console.error('   Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
        process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const ADMIN_EMAIL = 'admin@wrc.com';
    const ADMIN_PASSWORD = 'Admin2026!'; // 8+ chars, meets complexity requirements
    const ADMIN_USERNAME = 'admin';
    const ADMIN_ROLE = 'admin';
    
    console.log(`📧 Target admin email: ${ADMIN_EMAIL}\n`);
    
    // Step 1: Check if user exists
    console.log('🔍 Checking if admin user exists...');
    
    let userId = null;
    
    // Try to sign in first
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    });
    
    if (!signInError && signInData?.user) {
        console.log('✅ Admin user already exists and can sign in');
        userId = signInData.user.id;
    } else {
        // Try to sign up
        console.log('👤 Admin user not found, creating...');
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            options: {
                data: {
                    username: ADMIN_USERNAME,
                    role: ADMIN_ROLE
                }
            }
        });
        
        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                console.log('⚠️  User registered but cannot sign in');
                console.log('   You may need to reset the password via Supabase dashboard');
            } else {
                console.error(`❌ Sign up failed: ${signUpError.message}`);
            }
            process.exit(1);
        }
        
        if (signUpData?.user) {
            console.log('✅ Admin user created successfully');
            userId = signUpData.user.id;
        }
    }
    
    if (!userId) {
        console.error('❌ Could not get user ID');
        process.exit(1);
    }
    
    // Step 2: Ensure profile exists with correct role
    console.log('\n👤 Setting up admin profile...');
    
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: ADMIN_EMAIL,
            username: ADMIN_USERNAME,
            role: 'admin',
            is_admin: true,
            is_active: true
        })
        .select()
        .single();
    
    if (profileError) {
        console.error(`❌ Profile setup failed: ${profileError.message}`);
        process.exit(1);
    }
    
    console.log('✅ Admin profile created/updated');
    console.log(`   Role: ${profile.role}`);
    console.log(`   Is Admin: ${profile.is_admin}`);
    
    // Step 3: Verify admin status in auth
    console.log('\n🔐 Verifying admin permissions...');
    
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    if (authData?.user) {
        console.log('✅ User verified in Supabase Auth');
        console.log(`   Email: ${authData.user.email}`);
        console.log(`   Created: ${authData.user.created_at}`);
    }
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 Admin account setup complete!');
    console.log('═══════════════════════════════════════════════');
    console.log(`\n📋 Login credentials:`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`\n🌐 Admin Dashboard: /dashboard-admin.html`);
    console.log('\n⚠️  Make sure to save these credentials securely!');
    console.log('═══════════════════════════════════════════════\n');
}

setupAdmin().catch(err => {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
});