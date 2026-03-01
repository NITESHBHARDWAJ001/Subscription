# Quick Start Guide

## Get Running in 5 Minutes

### Step 1: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### Step 2: Setup Environment Variables

**Backend (.env):**
```bash
cd backend
copy .env.example .env
```

Edit `backend/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/saas-multitenant
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Step 3: Start MongoDB

Make sure MongoDB is running on your machine:

**Windows:**
```bash
net start MongoDB
```

**Mac/Linux:**
```bash
sudo systemctl start mongod
```

Or use MongoDB Compass/Atlas

### Step 4: Seed Database

```bash
cd backend
npm run seed
```

This creates:
- ✅ 4 subscription plans (Free, Starter, Pro, Enterprise)
- ✅ 5 features
- ✅ Plan-feature mappings
- ✅ Usage limits
- ✅ Demo accounts (see below)

### Step 5: Start Backend

```bash
cd backend
npm run dev
```

✅ Backend running on http://localhost:5000

### Step 6: Start Frontend

Open a new terminal:

```bash
cd frontend
npm run dev
```

✅ Frontend running on http://localhost:5173

### Step 7: Login & Test

Open http://localhost:5173 in your browser

**Demo Accounts:**

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Super Admin | admin@system.local | admin123 | Create plans, view all orgs |
| Org Admin | demo@example.com | demo123 | Manage org, create projects |
| User | user@example.com | user123 | View projects |

## Test the Entitlement System

### Test 1: Create Projects with Limits

1. Login as **demo@example.com** (Free Plan - 2 project limit)
2. Click **"Create Project"**
3. Create first project - ✅ Success
4. Create second project - ✅ Success
5. Try creating third project - ❌ **429 Error**: "Usage limit exceeded"

### Test 2: Upgrade Plan

1. Stay logged in as demo@example.com
2. Click **"Upgrade Plan"**
3. Select **"Starter"** or **"Professional"**
4. Click **"Upgrade to [Plan]"**
5. ✅ Now you can create more projects!

### Test 3: Invite Users

1. As demo@example.com (Org Admin)
2. Click **"Invite User"**
3. Fill in: Name, Email, Role
4. Click **"Send Invite"**
5. Check if user limit is respected (Free: 3 users max)

### Test 4: Super Admin Features

1. Logout and login as **admin@system.local**
2. You'll see:
   - All subscription plans
   - All organizations
   - Create/Edit plan functionality
3. Try creating a new plan:
   - Name: "Premium"
   - Price: 149
   - Click "Create Plan"

## Architecture Highlights

### 🔐 Multi-Tenant Security
- Every request automatically filtered by `organizationId`
- Users can only see their organization's data
- JWT token contains: userId, organizationId, role

### 🎯 Entitlement Enforcement
```
User Request → Auth Check → Entitlement Check → Action
                              ↓
                    ├─ Subscription valid?
                    ├─ Feature enabled?
                    └─ Usage under limit?
```

### 📊 Atomic Usage Tracking
- Uses MongoDB `$inc` for atomic increments
- Prevents race conditions
- Accurate usage counting

## API Testing with Postman/Thunder Client

### 1. Register Organization
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "organizationName": "Test Company",
  "email": "test@company.com",
  "password": "password123",
  "adminName": "John Doe"
}
```

### 2. Login
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "demo@example.com",
  "password": "demo123"
}
```

Copy the `token` from response.

### 3. Create Project (With Entitlement)
```http
POST http://localhost:5000/api/projects
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "name": "New Project",
  "description": "This will check entitlement"
}
```

Expected responses:
- ✅ `201` - Project created (if under limit)
- ❌ `429` - Usage limit exceeded
- ❌ `403` - Feature not in plan
- ❌ `402` - Subscription expired

## Next Steps

1. **Explore the Code:**
   - Check `backend/middleware/entitlementMiddleware.js`
   - Review `backend/services/usageService.js`
   - Understand multi-tenant patterns in controllers

2. **Customize:**
   - Add new features to the system
   - Create custom plans
   - Add more usage metrics

3. **Deploy:**
   - Set up MongoDB Atlas
   - Deploy backend to Heroku/Railway/AWS
   - Deploy frontend to Vercel/Netlify

## Troubleshooting

### Backend won't start
- Check if MongoDB is running
- Verify .env file exists with correct values
- Check port 5000 is not in use

### Frontend shows errors
- Make sure backend is running first
- Check browser console for errors
- Verify API_URL in frontend/.env

### Can't create projects
- This is expected if you hit the plan limit!
- Check current usage in dashboard
- Upgrade plan to increase limits

### 401 Unauthorized
- Token might be expired (7 days)
- Login again to get new token

---

**You're all set! 🎉**

Explore the dashboards, test the entitlement system, and see how a production SaaS works!
