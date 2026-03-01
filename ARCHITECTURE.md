# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Super Admin  │  │  Org Admin   │  │     User     │         │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           API Service (Axios + JWT Token)                │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express.js)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Middleware Stack                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │    Auth     │→ │   Tenant     │→ │  Entitlement   │  │  │
│  │  │ Middleware  │  │  Isolation   │  │   Middleware   │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Controllers                             │  │
│  │  • Auth  • Admin  • Organization  • Projects             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Business Services                        │  │
│  │  • Usage Tracking (Atomic)  • Subscription Logic         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (MongoDB)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │Organization │  │    User     │  │    Plan     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │Subscription │  │UsageTracker │  │   Project   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Feature    │  │ PlanFeature │  │ PlanLimit   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow: Creating a Project

```
1. USER ACTION
   └─> Click "Create Project" button in UI

2. FRONTEND
   └─> POST /api/projects
       Headers: { Authorization: Bearer JWT_TOKEN }
       Body: { name: "New Project", description: "..." }

3. BACKEND - Auth Middleware
   └─> Verify JWT token
   └─> Extract: userId, organizationId, role
   └─> Attach to req.user
   └─> Check if ORG_ADMIN role ✅

4. BACKEND - Tenant Middleware
   └─> Attach organizationId to req.tenantId
   └─> Ensure multi-tenant isolation

5. BACKEND - Entitlement Middleware
   ┌─────────────────────────────────────────┐
   │ checkEntitlement('CREATE_PROJECT',      │
   │                  'PROJECTS_COUNT')      │
   └─────────────────────────────────────────┘
        │
        ├─> Load active subscription for organizationId
        │   ├─> Not found? → 402 "No active subscription"
        │   └─> Found ✅
        │
        ├─> Check if subscription expired
        │   ├─> endDate < now? → 402 "Subscription expired"
        │   └─> Valid ✅
        │
        ├─> Check feature "CREATE_PROJECT" enabled in plan
        │   ├─> Not in plan? → 403 "Feature not available"
        │   └─> Enabled ✅
        │
        └─> Check usage limit for "PROJECTS_COUNT"
            ├─> Load PlanLimit (e.g., 2 projects)
            ├─> Load UsageTracker (current: 1 project)
            ├─> current >= limit? → 429 "Usage limit exceeded"
            └─> Under limit ✅

6. BACKEND - Project Controller
   └─> Create project in database
       {
         organizationId: req.user.organizationId,
         name: "New Project",
         createdBy: req.user.userId,
         members: [req.user.userId]
       }

7. BACKEND - Usage Service
   └─> UsageTracker.findOneAndUpdate
       {
         organizationId,
         metricKey: 'PROJECTS_COUNT'
       },
       { $inc: { count: 1 } },  ← ATOMIC INCREMENT
       { upsert: true }

8. RESPONSE
   └─> 201 Created
       {
         success: true,
         data: { project details }
       }

9. FRONTEND
   └─> Display success message
   └─> Reload projects list
   └─> Update usage counter in UI
```

## Multi-Tenant Data Isolation

### Problem
Multiple organizations use the same application. Organization A must never see Organization B's data.

### Solution
Every data query includes `organizationId` filter:

```javascript
// ❌ WRONG - No tenant isolation
const projects = await Project.find({ status: 'active' });

// ✅ CORRECT - Tenant isolated
const projects = await Project.find({
  organizationId: req.user.organizationId,
  status: 'active'
});
```

### JWT Token Structure
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "organizationId": "507f191e810c19729de860ea",
  "role": "ORG_ADMIN",
  "iat": 1640000000,
  "exp": 1640604800
}
```

## Entitlement System

### Core Concept
Backend validates EVERY action against:
1. **Active Subscription** - Is organization subscribed?
2. **Feature Access** - Does plan include this feature?
3. **Usage Limits** - Are they within quota?

### Example: Plan Configuration

**Free Plan:**
```javascript
{
  name: "Free",
  price: 0,
  features: [
    "CREATE_PROJECT"
  ],
  limits: {
    PROJECTS_COUNT: 2,
    USERS_COUNT: 3
  }
}
```

**Professional Plan:**
```javascript
{
  name: "Professional",
  price: 99,
  features: [
    "CREATE_PROJECT",
    "TEAM_COLLABORATION",
    "ADVANCED_ANALYTICS",
    "API_ACCESS"
  ],
  limits: {
    PROJECTS_COUNT: 50,
    USERS_COUNT: 50
  }
}
```

### Entitlement Check Logic

```javascript
// File: backend/middleware/entitlementMiddleware.js

const checkEntitlement = (requiredFeature, usageMetric) => {
  return async (req, res, next) => {
    const { organizationId } = req.user;

    // 1. Load subscription
    const subscription = await Subscription.findOne({
      organizationId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(402).json({ 
        error: 'No active subscription' 
      });
    }

    // 2. Check expiry
    if (subscription.endDate < new Date()) {
      return res.status(402).json({ 
        error: 'Subscription expired' 
      });
    }

    // 3. Check feature
    if (requiredFeature) {
      const hasFeature = await PlanFeatureMapping.findOne({
        planId: subscription.planId,
        featureId: /* feature lookup */,
        enabled: true
      });

      if (!hasFeature) {
        return res.status(403).json({ 
          error: 'Feature not in plan' 
        });
      }
    }

    // 4. Check usage limit
    if (usageMetric) {
      const limit = await PlanLimit.findOne({
        planId: subscription.planId,
        metricKey: usageMetric
      });

      const usage = await UsageTracker.findOne({
        organizationId,
        metricKey: usageMetric
      });

      if (usage.count >= limit.limit) {
        return res.status(429).json({ 
          error: 'Usage limit exceeded' 
        });
      }
    }

    next(); // ✅ All checks passed
  };
};
```

## Atomic Usage Tracking

### Why Atomic Operations?

**Problem:** Race condition when incrementing usage

```javascript
// ❌ BAD - Race condition possible
const usage = await UsageTracker.findOne({ organizationId });
usage.count = usage.count + 1;
await usage.save();
// If two requests happen simultaneously, count could be wrong!
```

**Solution:** MongoDB atomic operations

```javascript
// ✅ GOOD - Atomic increment
await UsageTracker.findOneAndUpdate(
  { organizationId, metricKey: 'PROJECTS_COUNT' },
  { $inc: { count: 1 } },  // ← Atomic operation
  { upsert: true }
);
```

### Benefits:
- ✅ No race conditions
- ✅ Guaranteed accuracy
- ✅ Single database operation
- ✅ Auto-creates document if missing (upsert)

## Database Schema Relationships

```
Organization (1) ────────┬──── (M) User
                        │
                        └──── (1) Subscription ──── (1) Plan
                                         │
                                         └──── (M) UsageTracker

Plan (1) ────────┬──── (M) PlanFeatureMapping ──── (1) Feature
                │
                └──── (M) PlanLimit

Organization (1) ──── (M) Project ──── (M) User (members)
```

## Role-Based Access Control

```
┌──────────────┬────────────────┬─────────────────┬──────────────┐
│ Action       │ SUPER_ADMIN    │ ORG_ADMIN       │ USER         │
├──────────────┼────────────────┼─────────────────┼──────────────┤
│ Create Plan  │ ✅             │ ❌              │ ❌           │
│ View All Orgs│ ✅             │ ❌              │ ❌           │
│ Create Proj  │ ❌ (N/A)       │ ✅ (w/ limits)  │ ❌           │
│ Invite User  │ ❌ (N/A)       │ ✅ (w/ limits)  │ ❌           │
│ View Projects│ ❌ (N/A)       │ ✅              │ ✅           │
│ Upgrade Plan │ ❌ (N/A)       │ ✅              │ ❌           │
└──────────────┴────────────────┴─────────────────┴──────────────┘
```

## Error Handling

### Standard Error Responses

```javascript
// 400 - Bad Request
{
  "success": false,
  "error": "Project name is required"
}

// 401 - Unauthorized
{
  "success": false,
  "error": "Invalid token"
}

// 402 - Payment Required (Subscription)
{
  "success": false,
  "error": "Subscription has expired"
}

// 403 - Forbidden (Feature Access)
{
  "success": false,
  "error": "Feature not available in your Free plan"
}

// 429 - Too Many Requests (Usage Limit)
{
  "success": false,
  "error": "Usage limit exceeded. Maximum 2 projects allowed"
}

// 500 - Internal Server Error
{
  "success": false,
  "error": "Internal server error"
}
```

## Security Measures

1. **Password Hashing**: bcrypt with salt rounds
2. **JWT Tokens**: Signed with secret, 7-day expiry
3. **Multi-Tenant Isolation**: Every query filtered by organizationId
4. **Role-Based Access**: Middleware checks user role
5. **Input Validation**: Express-validator on routes
6. **CORS**: Restricted to CLIENT_URL
7. **Error Sanitization**: No stack traces in production

## Scalability Considerations

### Horizontal Scaling
- ✅ Stateless backend (JWT tokens)
- ✅ MongoDB replica sets
- ✅ Load balancer ready

### Performance Optimizations
- ✅ Database indexes on organizationId
- ✅ Compound indexes for common queries
- ✅ Atomic operations (no read-modify-write)
- ✅ Efficient aggregation pipelines

### Future Enhancements
- [ ] Redis caching for plans/features
- [ ] Background jobs for analytics
- [ ] Stripe payment integration
- [ ] Email service (SendGrid/AWS SES)
- [ ] Rate limiting per organization
- [ ] Webhooks for subscription events

---

This architecture ensures a production-ready, scalable, and secure multi-tenant SaaS platform with proper subscription and entitlement enforcement.
