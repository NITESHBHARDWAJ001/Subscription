# Multi-Tenant SaaS Platform

A production-grade MERN stack multi-tenant SaaS application with subscription and feature entitlement system enforced at the API level.

## Architecture Overview

### Backend Architecture
- **Multi-Tenant Data Isolation**: All data queries filtered by `organizationId`
- **JWT Authentication**: Secure token-based authentication with role-based access control
- **Entitlement Middleware**: Centralized subscription and feature validation
- **Atomic Usage Tracking**: MongoDB `$inc` operations for accurate usage counting
- **Database-Driven Plans**: No hardcoded subscription logic

### Frontend Architecture
- **Role-Based Routing**: Automatic redirection based on user role
- **Simple, Functional UI**: Clean Tailwind CSS interface focused on functionality
- **Axios API Integration**: Centralized API service with JWT token management
- **Context-Based Auth**: React Context for global authentication state

## Tech Stack

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT (jsonwebtoken)
- bcrypt for password hashing

### Frontend
- React 18 (Vite)
- Tailwind CSS v3
- React Router v6
- React Icons
- Axios

## Database Collections

1. **Organization** - Multi-tenant organizations
2. **User** - Users with role-based access
3. **Plan** - Subscription plans (database-driven)
4. **Feature** - Available features
5. **PlanFeatureMapping** - Features enabled per plan
6. **PlanLimit** - Usage limits per plan
7. **Subscription** - Active subscriptions per organization
8. **UsageTracker** - Real-time usage tracking
9. **Project** - Project management entity

## User Roles

### SUPER_ADMIN
- Create and edit plans
- View all organizations
- Manage features

### ORG_ADMIN
- Invite users to organization
- Create projects (within plan limits)
- Upgrade subscription
- View organization dashboard

### USER
- View assigned projects
- View organization information

## Critical Features

### 1. Entitlement Middleware
Located at: `backend/middleware/entitlementMiddleware.js`

Enforces:
- ✅ Subscription validity (not expired)
- ✅ Feature access (enabled in plan)
- ✅ Usage limits (within plan limits)

Returns:
- **402** - Subscription expired
- **403** - Feature not available in plan
- **429** - Usage limit exceeded

### 2. Usage Tracking Service
Located at: `backend/services/usageService.js`

- Atomic increment/decrement operations
- Prevents race conditions
- Tracks: Projects, Users, etc.

### 3. Multi-Tenant Isolation
Every protected route filters by `organizationId` from JWT token.

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your configuration
# MONGODB_URI=mongodb://localhost:27017/saas-multitenant
# JWT_SECRET=your-secret-key
# PORT=5000

# Seed the database with initial data
npm run seed

# Start the server
npm run dev
```

The seed script will create:
- **Super Admin**: admin@system.local / admin123
- **Demo Org Admin**: demo@example.com / demo123
- **Demo User**: user@example.com / user123
- 4 Plans: Free, Starter, Professional, Enterprise
- 5 Features with plan mappings
- Usage limits per plan

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file (optional)
cp .env.example .env

# Start development server
npm run dev
```

Frontend will run on: http://localhost:5173

## API Endpoints

### Authentication
```
POST   /api/auth/register          # Register organization
POST   /api/auth/login             # Login
GET    /api/auth/me                # Get current user
```

### Super Admin
```
POST   /api/admin/plans            # Create plan
GET    /api/admin/plans            # List plans
PUT    /api/admin/plans/:id        # Update plan
GET    /api/admin/organizations    # List organizations
POST   /api/admin/features         # Create feature
GET    /api/admin/features         # List features
```

### Organization Admin
```
POST   /api/organization/invite               # Invite user
GET    /api/organization/users                # List users
GET    /api/organization/subscription         # Get subscription details
PUT    /api/organization/subscription/upgrade # Upgrade plan
```

### Projects (Protected by Entitlement)
```
POST   /api/projects              # Create project (entitlement enforced)
GET    /api/projects              # List projects
GET    /api/projects/:id          # Get project
PUT    /api/projects/:id          # Update project
DELETE /api/projects/:id          # Delete project
```

## Testing the Entitlement System

### Test Scenario 1: Feature Access
1. Login as demo@example.com (Free Plan)
2. Try to create a project
3. System checks if CREATE_PROJECT feature is enabled
4. ✅ Allowed (Free plan has this feature)

### Test Scenario 2: Usage Limit
1. On Free plan (limit: 2 projects)
2. Create first project - ✅ Success
3. Create second project - ✅ Success
4. Create third project - ❌ 429 Error: "Usage limit exceeded"

### Test Scenario 3: Subscription Upgrade
1. Login as org admin
2. Upgrade from Free to Professional
3. Can now create up to 50 projects
4. New features unlocked (Advanced Analytics, API Access)

## Project Structure

```
backend/
├── config/
│   └── db.js                      # MongoDB connection
├── middleware/
│   ├── authMiddleware.js          # JWT authentication
│   ├── entitlementMiddleware.js   # Subscription & feature enforcement
│   ├── tenantMiddleware.js        # Multi-tenant isolation
│   └── errorHandler.js            # Global error handler
├── models/                        # Mongoose schemas
│   ├── Organization.js
│   ├── User.js
│   ├── Plan.js
│   ├── Feature.js
│   ├── PlanFeatureMapping.js
│   ├── PlanLimit.js
│   ├── Subscription.js
│   ├── UsageTracker.js
│   └── Project.js
├── controllers/
│   ├── authController.js
│   ├── adminController.js
│   ├── organizationController.js
│   └── projectController.js
├── routes/
│   ├── authRoutes.js
│   ├── adminRoutes.js
│   ├── organizationRoutes.js
│   └── projectRoutes.js
├── services/
│   └── usageService.js            # Atomic usage tracking
├── scripts/
│   └── seed.js                    # Database seeding
└── server.js

frontend/
├── src/
│   ├── context/
│   │   └── AuthContext.jsx        # Authentication state
│   ├── services/
│   │   └── api.js                 # Axios API client
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── SuperAdminDashboard.jsx
│   │   ├── OrganizationDashboard.jsx
│   │   └── UserDashboard.jsx
│   ├── App.jsx                    # Routing
│   ├── main.jsx
│   └── index.css                  # Tailwind styles
├── tailwind.config.js
└── vite.config.js
```

## Key Implementation Details

### JWT Payload Structure
```javascript
{
  userId: ObjectId,
  organizationId: ObjectId,
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'USER'
}
```

### Entitlement Check Flow
```
1. Request → Auth Middleware (verify JWT)
2. Tenant Middleware (attach organizationId)
3. Entitlement Middleware:
   - Load active subscription
   - Check if expired → 402
   - Check feature enabled → 403
   - Check usage limit → 429
   - ✅ Allow request
4. Controller logic
5. Usage tracking (atomic increment)
```

### Multi-Tenant Query Pattern
```javascript
// ALWAYS include organizationId in queries
const projects = await Project.find({
  organizationId: req.user.organizationId,
  status: 'active'
});
```

## Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Role-based access control
- ✅ Multi-tenant data isolation
- ✅ Input validation
- ✅ Error handling with appropriate HTTP codes
- ✅ CORS configuration

## Production Considerations

### Before Deploying:
1. Change JWT_SECRET to a strong random string
2. Set NODE_ENV=production
3. Configure MongoDB Atlas or production database
4. Set up proper CORS origins
5. Enable HTTPS
6. Add rate limiting
7. Implement email service for user invitations
8. Add logging (Winston, Morgan)
9. Set up monitoring (Sentry, DataDog)
10. Implement payment gateway integration

## Development Commands

### Backend
```bash
npm run dev       # Start with nodemon
npm start         # Start production
npm run seed      # Seed database
```

### Frontend
```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
```

## Common Issues & Solutions

### MongoDB Connection Error
- Ensure MongoDB is running locally
- Check MONGODB_URI in .env

### JWT Token Expired
- Token expires after 7 days by default
- User needs to login again

### 402/403/429 Errors
- These are entitlement errors (expected behavior)
- Upgrade plan to access more features/limits

## License

MIT

## Support

For issues or questions, refer to the code documentation or create an issue in the repository.

---

**Built with ❤️ following production-grade SaaS architecture principles**
