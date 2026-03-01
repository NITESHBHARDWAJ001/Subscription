# Deployment Guide

## Current Deployment URLs
- **Frontend (Vercel)**: https://subscription-rho-one.vercel.app
- **Backend (Render)**: https://subscription-0m1k.onrender.com

## Issues Fixed

### 1. CORS Error (Trailing Slash Issue)
**Problem**: Backend was responding with `Access-Control-Allow-Origin: https://subscription-rho-one.vercel.app/` (with trailing slash), but frontend origin was `https://subscription-rho-one.vercel.app` (no trailing slash).

**Solution**: Updated `backend/server.js` to:
- Automatically remove trailing slashes from origins
- Support multiple allowed origins
- Better CORS configuration with proper headers

### 2. 404 Error on Login
**Problem**: `/api/auth/login` endpoint returning 404

**Possible Causes**:
1. Backend routes not properly configured
2. Environment variables not set on Render
3. Database connection issues

---

## Backend Deployment (Render)

### Environment Variables to Set on Render:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-production-jwt-secret-key-min-32-chars
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=production
CLIENT_URL=https://subscription-rho-one.vercel.app
```

### Deployment Steps:

1. **Go to Render Dashboard** → https://dashboard.render.com

2. **Select your backend service** (subscription-0m1k.onrender.com)

3. **Environment Tab** → Add/Update variables:
   - ✅ `MONGODB_URI` - Your MongoDB Atlas connection string
   - ✅ `JWT_SECRET` - Strong secret key (32+ characters)
   - ✅ `CLIENT_URL` - `https://subscription-rho-one.vercel.app` (NO trailing slash)
   - ✅ `NODE_ENV` - `production`

4. **Manual Deploy** → Click "Manual Deploy" → "Deploy latest commit"

5. **Check Logs** for any errors:
   ```bash
   ✓ Server running on port 5000
   ✓ MongoDB connected
   ```

6. **Test Health Endpoint**: 
   - Visit: https://subscription-0m1k.onrender.com/health
   - Should return: `{"status":"OK","timestamp":"..."}`

7. **Test API Root**:
   - Visit: https://subscription-0m1k.onrender.com/
   - Should show API endpoints list

---

## Frontend Deployment (Vercel)

### Environment Variables to Set on Vercel:

```env
VITE_API_URL=https://subscription-0m1k.onrender.com/api
```

### Deployment Steps:

1. **Go to Vercel Dashboard** → https://vercel.com/dashboard

2. **Select your project** (subscription-rho-one)

3. **Settings** → **Environment Variables**:
   - Add `VITE_API_URL` = `https://subscription-0m1k.onrender.com/api`
   - Apply to: Production, Preview, Development

4. **Deployments** → **Redeploy**
   - Click three dots on latest deployment
   - Select "Redeploy"
   - ✅ Check "Use existing Build Cache"

5. **Wait for deployment** to complete

---

## MongoDB Setup (MongoDB Atlas)

### Connection String Format:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

### Steps:

1. **Go to MongoDB Atlas** → https://cloud.mongodb.com

2. **Database Access**:
   - Create database user with username and password
   - Note credentials for `MONGODB_URI`

3. **Network Access**:
   - Add IP: `0.0.0.0/0` (Allow from anywhere)
   - Or add Render's IP addresses

4. **Connect**:
   - Click "Connect"
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<password>` and `<database>` with your values

---

## Verification Checklist

### Backend Health:
- [ ] https://subscription-0m1k.onrender.com/health returns `{"status":"OK"}`
- [ ] https://subscription-0m1k.onrender.com/ shows API endpoints
- [ ] Logs show: ✓ MongoDB connected
- [ ] Logs show: ✓ Server running on port 5000

### Frontend:
- [ ] https://subscription-rho-one.vercel.app loads
- [ ] Login page shows without errors
- [ ] Browser console has no CORS errors
- [ ] Can attempt login (even if credentials are wrong, no CORS error)

### Database:
- [ ] Seeded with initial data (run seed script)
- [ ] Collections exist: users, organizations, plans, subscriptions

---

## Troubleshooting

### CORS Error Persists:
1. Check Render environment variable `CLIENT_URL` has NO trailing slash
2. Redeploy backend after changing env vars
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### 404 on Login:
1. Check Render logs for route errors
2. Verify `authRoutes.js` is being loaded
3. Test directly: `curl https://subscription-0m1k.onrender.com/api/auth/login`

### MongoDB Connection Error:
1. Check MongoDB Atlas whitelist includes `0.0.0.0/0`
2. Verify connection string format is correct
3. Check username/password has no special characters (or URL encode them)

### Frontend Can't Connect:
1. Check `VITE_API_URL` in Vercel is correct
2. Redeploy frontend after env var changes
3. Check browser Network tab for actual URL being called

---

## Seed Database on Production

### Option 1: Via Render Shell
1. Render Dashboard → Your Service → Shell
2. Run: `npm run seed`

### Option 2: Via Local Script
1. Update local `.env` with production MongoDB URI
2. Run: `npm run seed`
3. Revert `.env` to local settings

---

## Testing the Deployment

### 1. Test Backend Directly:
```bash
curl https://subscription-0m1k.onrender.com/health
curl https://subscription-0m1k.onrender.com/api/public/plans
```

### 2. Test Login:
```bash
curl -X POST https://subscription-0m1k.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@system.com","password":"admin123"}'
```

### 3. Test from Frontend:
- Open: https://subscription-rho-one.vercel.app
- Open Browser DevTools (F12) → Network tab
- Try to login
- Check requests go to correct backend URL
- Check for CORS errors in Console

---

## Post-Deployment

### Create Test Accounts:
Run seed script to create:
- Super Admin: `admin@system.com` / `admin123`
- Org Admin: `admin@acme.com` / `password123`
- Regular User: `user@acme.com` / `password123`

### Monitor:
- **Render Logs**: Check for errors and performance
- **Vercel Analytics**: Monitor frontend performance  
- **MongoDB Atlas**: Watch database usage and connections

---

## Quick Fix Commands

### If you need to redeploy everything:

**Backend (Push to GitHub):**
```bash
cd e:/AAS
git add .
git commit -m "Fix CORS and 404 issues"
git push origin main
```
Render will auto-deploy from GitHub.

**Frontend:**
Just redeploy from Vercel dashboard or push to trigger auto-deployment.

---

## Support

If issues persist:
1. Check Render logs for specific errors
2. Check Vercel logs for build/runtime errors
3. Test backend endpoints with Postman/curl
4. Verify all environment variables are set correctly
