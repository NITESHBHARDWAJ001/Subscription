# 🔐 Super Admin Bootstrap Guide

## Overview

This system includes **TWO secure methods** to create the initial Super Admin account:

1. **Bootstrap Endpoint** - One-time HTTP endpoint (production-ready)
2. **Seed Script** - Command-line script (development-friendly)

Both methods are:
- ✅ Production-grade secure
- ✅ Idempotent (safe to run multiple times)
- ✅ Permanently disabled after first Super Admin exists

---

## 🚨 Security Features

### ✓ Protection Mechanisms

1. **Setup Key Authentication**: Requires secret key in HTTP header
2. **One-Time Use**: Automatically disables after first Super Admin
3. **Hardcoded Role**: Role cannot be overridden from client
4. **Password Hashing**: BCrypt with salt rounds
5. **Email Validation**: Format and uniqueness checks
6. **No Public Exposure**: Not linked in frontend

---

## Method 1: Bootstrap Endpoint (Recommended for Production)

### Step 1: Configure Environment

Add to `.env`:

```env
SUPER_ADMIN_SETUP_KEY=your-very-secret-random-key-here
```

**Generate a secure key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Check Bootstrap Status

```bash
curl http://localhost:5000/api/system/bootstrap-status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bootstrapRequired": true,
    "systemInitialized": false
  }
}
```

### Step 3: Create Super Admin

```bash
curl -X POST http://localhost:5000/api/system/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: your-very-secret-random-key-here" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "YourSecurePassword123!",
    "name": "System Administrator"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Super Admin created successfully. Bootstrap endpoint is now permanently disabled.",
  "data": {
    "_id": "...",
    "name": "System Administrator",
    "email": "admin@yourdomain.com",
    "role": "SUPER_ADMIN",
    "organizationId": "...",
    "createdAt": "2026-03-03T..."
  }
}
```

### Step 4: Verify Endpoint is Disabled

Try again:
```bash
curl -X POST http://localhost:5000/api/system/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: your-very-secret-random-key-here" \
  -d '{ "email": "test@test.com", "password": "Test123!", "name": "Test" }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Super Admin already exists. Bootstrap endpoint is disabled."
}
```

---

## Method 2: Seed Script (Recommended for Development)

### Step 1: Configure Environment

Add to `.env`:

```env
SUPER_ADMIN_EMAIL=admin@system.com
SUPER_ADMIN_PASSWORD=SuperAdmin123!
SUPER_ADMIN_NAME=System Administrator
```

### Step 2: Run Script

```bash
cd backend
node scripts/seedSuperAdmin.js
```

### Step 3: View Output

**First Run (No Super Admin exists):**
```
🔐 Super Admin Seed Script Starting...

✓ Connected to database

⚠️  No Super Admin found. Creating...

Creating System Administration organization...
✓ Organization created

Hashing password...
✓ Password hashed

Creating Super Admin user...
✓ Super Admin created successfully!

═══════════════════════════════════════════
Super Admin Details:
═══════════════════════════════════════════
Name:         System Administrator
Email:        admin@system.com
Role:         SUPER_ADMIN
Organization: System Administration
Created:      Mon Mar 03 2026 ...
═══════════════════════════════════════════

✅ Super Admin seed completed successfully!

You can now login with:
   Email: admin@system.com
   Password: [the one you set in .env]
```

**Second Run (Super Admin exists):**
```
🔐 Super Admin Seed Script Starting...

✓ Connected to database

ℹ️  Super Admin already exists:
   Email: admin@system.com
   Name: System Administrator
   Created: Mon Mar 03 2026 ...

✓ No action needed. Exiting.
```

---

## 🔒 Security Best Practices

### Production Deployment Checklist

- [ ] Generate strong `SUPER_ADMIN_SETUP_KEY` using crypto.randomBytes()
- [ ] Store setup key in secure environment variables (never commit to git)
- [ ] Use HTTPS only for bootstrap endpoint
- [ ] Create Super Admin immediately after deployment
- [ ] Delete `SUPER_ADMIN_SETUP_KEY` from environment after use
- [ ] Never expose `/api/system/bootstrap-super-admin` in frontend UI
- [ ] Use strong password (min 12 chars, mixed case, numbers, symbols)
- [ ] Enable MFA for Super Admin account (if implemented)
- [ ] Rotate Super Admin password regularly
- [ ] Audit Super Admin access logs

### What NOT to do

❌ **Never** commit `.env` file to git  
❌ **Never** hardcode setup key in code  
❌ **Never** expose bootstrap endpoint publicly  
❌ **Never** use weak passwords  
❌ **Never** share Super Admin credentials  
❌ **Never** create multiple Super Admins via this method  

---

## 🧪 Testing the Implementation

### Test 1: Invalid Setup Key

```bash
curl -X POST http://localhost:5000/api/system/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: wrong-key" \
  -d '{ "email": "test@test.com", "password": "Test123!", "name": "Test" }'
```

**Expected:** `403 Forbidden - Invalid or missing setup key`

### Test 2: Missing Setup Key Header

```bash
curl -X POST http://localhost:5000/api/system/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -d '{ "email": "test@test.com", "password": "Test123!", "name": "Test" }'
```

**Expected:** `403 Forbidden - Invalid or missing setup key`

### Test 3: Invalid Email Format

```bash
curl -X POST http://localhost:5000/api/system/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: your-setup-key" \
  -d '{ "email": "invalid-email", "password": "Test123!", "name": "Test" }'
```

**Expected:** `400 Bad Request - Please provide a valid email address`

### Test 4: Weak Password

```bash
curl -X POST http://localhost:5000/api/system/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: your-setup-key" \
  -d '{ "email": "test@test.com", "password": "weak", "name": "Test" }'
```

**Expected:** `400 Bad Request - Password must be at least 8 characters long`

### Test 5: Duplicate Creation

Run the same valid request twice:

**Expected on 2nd attempt:** `403 Forbidden - Super Admin already exists`

---

## 📊 Error Codes Reference

| Status | Error | Reason |
|--------|-------|--------|
| 403 | Invalid or missing setup key | Wrong or missing `x-setup-key` header |
| 403 | Super Admin already exists | Bootstrap already completed |
| 500 | SUPER_ADMIN_SETUP_KEY missing | Env variable not configured |
| 400 | Please provide all required fields | Missing email, password, or name |
| 400 | Please provide a valid email address | Invalid email format |
| 400 | Password must be at least 8 characters | Password too short |
| 400 | Email already registered | Email exists in database |

---

## 🔧 Troubleshooting

### Problem: "SUPER_ADMIN_SETUP_KEY missing in environment"

**Solution:**
1. Check `.env` file exists in backend directory
2. Verify `SUPER_ADMIN_SETUP_KEY` is set
3. Restart server after adding env variable

### Problem: "Super Admin already exists"

**Solutions:**
1. ✅ **Production:** This is correct behavior - no action needed
2. 🧪 **Testing:** Clear database and try again:
   ```bash
   # WARNING: Deletes all data
   node scripts/seed.js  # Or manually clear User collection
   ```

### Problem: Seed script says "Missing required environment variables"

**Solution:**
Add to `.env`:
```env
SUPER_ADMIN_EMAIL=admin@system.com
SUPER_ADMIN_PASSWORD=YourPassword123!
SUPER_ADMIN_NAME=System Administrator
```

---

## 🎯 Quick Start (Choose One)

### Option A: HTTP Endpoint (Production)

```bash
# 1. Set setup key
echo 'SUPER_ADMIN_SETUP_KEY=your-secret-key' >> backend/.env

# 2. Start server
cd backend && npm start

# 3. Create Super Admin
curl -X POST http://localhost:5000/api/system/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: your-secret-key" \
  -d '{"email": "admin@example.com", "password": "SecurePass123!", "name": "Admin"}'
```

### Option B: Seed Script (Development)

```bash
# 1. Configure credentials
echo 'SUPER_ADMIN_EMAIL=admin@system.com' >> backend/.env
echo 'SUPER_ADMIN_PASSWORD=SuperAdmin123!' >> backend/.env
echo 'SUPER_ADMIN_NAME=System Administrator' >> backend/.env

# 2. Run seed
cd backend && node scripts/seedSuperAdmin.js
```

---

## 📝 API Endpoints Summary

### Bootstrap Status (Public)
```
GET /api/system/bootstrap-status
```

Returns whether Super Admin exists.

### Bootstrap Super Admin (Protected)
```
POST /api/system/bootstrap-super-admin
Headers: x-setup-key
Body: { email, password, name }
```

One-time Super Admin creation.

---

## 🔗 Related Documentation

- [Authentication Guide](./AUTH.md)
- [Role-Based Access Control](./RBAC.md)
- [Environment Configuration](./ENV_CONFIG.md)
- [Security Best Practices](./SECURITY.md)

---

## 📞 Support

If you encounter issues:

1. Check troubleshooting section above
2. Verify environment variables are correctly set
3. Check server logs for detailed error messages
4. Ensure MongoDB connection is working

---

**Last Updated:** March 3, 2026  
**Version:** 1.0.0
