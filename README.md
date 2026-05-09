# WRC 2026 - World Rap Championship

A modern web application for the World Rap Championship 2026 tournament.

## 🚀 Quick Setup

### 1. Environment Configuration

Copy `.env.example` to `.env` and ensure it contains:

```env
VITE_SUPABASE_URL=https://ycgasfujxycqmbmiedaw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZ2FzZnVqeHljcW1ibWllZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1OTI2NTAsImV4cCI6MjA4MjE2ODY1MH0.n1-XIs2wqPF8lr4nkVSBsLm_ylW_J7NrqqTwz1z4ftQ
VITE_APP_NAME=WRC 2026
VITE_APP_VERSION=5.0.0
VITE_APP_URL=http://localhost:5173
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

---

## 🔐 Admin Account Setup

### Option 1: Using the Setup Script (Recommended)

```bash
node scripts/setup-admin.js
```

This will:
- Create the admin user if it doesn't exist
- Set up the admin profile in the database
- Verify the account is working

**Default Admin Credentials:**
- Email: `admin@wrc.com`
- Password: `Admin2026!`

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add User** and create:
   - Email: `admin@wrc.com`
   - Password: `Admin2026!` (or your preferred secure password)
4. In the **profiles** table, ensure the user has:
   - `role`: `admin`
   - `is_admin`: `true`

### Option 3: Database SQL Setup

Run this SQL in Supabase SQL Editor:

```sql
-- Create admin user (if not exists)
INSERT INTO profiles (id, email, username, role, is_admin, is_active)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'admin@wrc.com'),
    'admin@wrc.com',
    'admin',
    'admin',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    is_admin = true;
```

---

## 📋 Protected Pages

The following pages require authentication:

| Page | Access |
|------|--------|
| `dashboard.html` | Logged in users |
| `dashboard-admin.html` | Admin role only |
| `dashboard-jury.html` | Jury or Admin role |
| `tournament-arena.html` | Logged in users |
| `profile-edit.html` | Logged in users |

---

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Project Structure

```
src/
├── index.html           # Home page
├── dashboard.html      # Dashboard (fan/jury)
├── dashboard-admin.html # Admin panel
├── dashboard-jury.html  # Jury panel
├── tournament-arena.html # Battle arena
├── tournament-registration.html # Registration
├── profile-edit.html    # User profile
├── js/
│   ├── auth/           # Authentication module
│   ├── admin/          # Admin dashboard modules
│   ├── dashboard/      # Dashboard modules
│   ├── core/           # Core utilities (config, supabase)
│   └── components/     # UI components (nav, toast, player)
├── css/               # Stylesheets
└── main.js            # Application entry point
```

---

## 🔧 Troubleshooting

### Buttons Not Working

1. Check browser console for errors
2. Ensure `.env` file exists with valid Supabase credentials
3. Verify Supabase project is accessible

### Page Protection Not Working

The system now supports both URL formats:
- `/dashboard-admin` (Vite dev server)
- `/dashboard-admin.html` (production)

### Admin Access Denied

1. Ensure admin account has `role: 'admin'` in the profiles table
2. Check that the email matches exactly: `admin@wrc.com`

---

WRC 2026 © World Rap Championship v5.0.0