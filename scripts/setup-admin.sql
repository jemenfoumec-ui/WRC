-- WRC 2026 - Create Admin User
-- To be run in the Supabase SQL Editor

-- 1. Create the user in auth.users
-- Note: You should do this via the Supabase Dashboard -> Authentication -> Users -> Add User
-- Email: admin@wrc.com
-- Password: admin (or admin2026 for security)

-- 2. Once the user is created, get their ID and run this:
DO $$
DECLARE
    admin_id UUID;
    admin_email TEXT := 'admin@wrc.com';
BEGIN
    -- Try to find the user ID by email
    SELECT id INTO admin_id FROM auth.users WHERE email = admin_email;
    
    IF admin_id IS NOT NULL THEN
        -- Insert or update the profile
        INSERT INTO public.profiles (id, email, username, role, is_admin)
        VALUES (admin_id, admin_email, 'admin', 'admin', true)
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            is_admin = true;
            
        RAISE NOTICE 'User % has been assigned the admin role.', admin_email;
    ELSE
        RAISE NOTICE 'User % not found. Please create the user first in the Auth dashboard.', admin_email;
    END IF;
END $$;
