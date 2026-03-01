require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');

// Models
const Organization = require('../models/Organization');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Feature = require('../models/Feature');
const PlanFeatureMapping = require('../models/PlanFeatureMapping');
const PlanLimit = require('../models/PlanLimit');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const SubscriptionHistory = require('../models/SubscriptionHistory');

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('🗑️  Clearing existing data...');
    
    // Clear existing data
    await Promise.all([
      Organization.deleteMany({}),
      User.deleteMany({}),
      Plan.deleteMany({}),
      Feature.deleteMany({}),
      PlanFeatureMapping.deleteMany({}),
      PlanLimit.deleteMany({}),
      Subscription.deleteMany({}),
      Payment.deleteMany({}),
      SubscriptionHistory.deleteMany({})
    ]);

    console.log('✓ Data cleared');

    // ============ CREATE FEATURES ============
    console.log('\n📦 Creating features...');

    const features = await Feature.insertMany([
      { name: 'Create Project', key: 'CREATE_PROJECT', description: 'Ability to create projects' },
      { name: 'Advanced Analytics', key: 'ADVANCED_ANALYTICS', description: 'Access to advanced analytics' },
      { name: 'Team Collaboration', key: 'TEAM_COLLABORATION', description: 'Collaborate with team members' },
      { name: 'API Access', key: 'API_ACCESS', description: 'Access to REST API' },
      { name: 'Priority Support', key: 'PRIORITY_SUPPORT', description: '24/7 priority support' }
    ]);

    console.log(`✓ Created ${features.length} features`);

    // ============ CREATE PLANS ============
    console.log('\n💳 Creating plans...');

    const freePlan = await Plan.create({
      name: 'Free',
      slug: 'free',
      description: 'Perfect for trying out',
      price: 0,
      billingCycle: 'monthly',
      durationDays: 3650, // 10 years for free plan
      hasTrialPeriod: false, // No trial for free plan
      isActive: true
    });

    const starterPlan = await Plan.create({
      name: 'Starter',
      slug: 'starter',
      description: 'For small teams',
      price: 29,
      billingCycle: 'monthly',
      durationDays: 30,
      hasTrialPeriod: true,
      trialDays: 14,
      gracePeriodDays: 3,
      isActive: true
    });

    const proPlan = await Plan.create({
      name: 'Professional',
      slug: 'professional',
      description: 'For growing businesses',
      price: 99,
      billingCycle: 'monthly',
      durationDays: 30,
      hasTrialPeriod: true,
      trialDays: 14,
      gracePeriodDays: 3,
      isActive: true
    });

    const enterprisePlan = await Plan.create({
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large organizations',
      price: 299,
      billingCycle: 'monthly',
      durationDays: 30,
      hasTrialPeriod: true,
      trialDays: 14,
      gracePeriodDays: 3,
      isActive: true
    });

    console.log('✓ Created 4 plans with trial period configuration');

    // ============ MAP FEATURES TO PLANS ============
    console.log('\n🔗 Mapping features to plans...');

    const featureMap = {
      CREATE_PROJECT: features.find(f => f.key === 'CREATE_PROJECT')._id,
      ADVANCED_ANALYTICS: features.find(f => f.key === 'ADVANCED_ANALYTICS')._id,
      TEAM_COLLABORATION: features.find(f => f.key === 'TEAM_COLLABORATION')._id,
      API_ACCESS: features.find(f => f.key === 'API_ACCESS')._id,
      PRIORITY_SUPPORT: features.find(f => f.key === 'PRIORITY_SUPPORT')._id
    };

    // Free plan features
    await PlanFeatureMapping.insertMany([
      { planId: freePlan._id, featureId: featureMap.CREATE_PROJECT, enabled: true }
    ]);

    // Starter plan features
    await PlanFeatureMapping.insertMany([
      { planId: starterPlan._id, featureId: featureMap.CREATE_PROJECT, enabled: true },
      { planId: starterPlan._id, featureId: featureMap.TEAM_COLLABORATION, enabled: true }
    ]);

    // Pro plan features
    await PlanFeatureMapping.insertMany([
      { planId: proPlan._id, featureId: featureMap.CREATE_PROJECT, enabled: true },
      { planId: proPlan._id, featureId: featureMap.TEAM_COLLABORATION, enabled: true },
      { planId: proPlan._id, featureId: featureMap.ADVANCED_ANALYTICS, enabled: true },
      { planId: proPlan._id, featureId: featureMap.API_ACCESS, enabled: true }
    ]);

    // Enterprise plan features (all features)
    await PlanFeatureMapping.insertMany([
      { planId: enterprisePlan._id, featureId: featureMap.CREATE_PROJECT, enabled: true },
      { planId: enterprisePlan._id, featureId: featureMap.TEAM_COLLABORATION, enabled: true },
      { planId: enterprisePlan._id, featureId: featureMap.ADVANCED_ANALYTICS, enabled: true },
      { planId: enterprisePlan._id, featureId: featureMap.API_ACCESS, enabled: true },
      { planId: enterprisePlan._id, featureId: featureMap.PRIORITY_SUPPORT, enabled: true }
    ]);

    console.log('✓ Features mapped to plans');

    // ============ SET PLAN LIMITS ============
    console.log('\n📊 Setting plan limits...');

    // Free plan limits
    await PlanLimit.insertMany([
      { planId: freePlan._id, metricKey: 'PROJECTS_COUNT', metricName: 'projects', limit: 2 },
      { planId: freePlan._id, metricKey: 'USERS_COUNT', metricName: 'users', limit: 3 }
    ]);

    // Starter plan limits
    await PlanLimit.insertMany([
      { planId: starterPlan._id, metricKey: 'PROJECTS_COUNT', metricName: 'projects', limit: 10 },
      { planId: starterPlan._id, metricKey: 'USERS_COUNT', metricName: 'users', limit: 10 }
    ]);

    // Pro plan limits
    await PlanLimit.insertMany([
      { planId: proPlan._id, metricKey: 'PROJECTS_COUNT', metricName: 'projects', limit: 50 },
      { planId: proPlan._id, metricKey: 'USERS_COUNT', metricName: 'users', limit: 50 }
    ]);

    // Enterprise plan limits
    await PlanLimit.insertMany([
      { planId: enterprisePlan._id, metricKey: 'PROJECTS_COUNT', metricName: 'projects', limit: 999 },
      { planId: enterprisePlan._id, metricKey: 'USERS_COUNT', metricName: 'users', limit: 999 }
    ]);

    console.log('✓ Plan limits configured');

    // ============ CREATE SUPER ADMIN ============
    console.log('\n👤 Creating super admin...');

    const superAdminOrg = await Organization.create({
      name: 'System Administration',
      slug: 'system-admin',
      email: 'admin@system.local',
      status: 'active'
    });

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const superAdmin = await User.create({
      organizationId: superAdminOrg._id,
      email: 'admin@system.local',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'active'
    });

    console.log('✓ Super admin created');
    console.log('  Email: admin@system.local');
    console.log('  Password: admin123');

    // ============ CREATE DEMO ORGANIZATION ============
    console.log('\n🏢 Creating demo organization...');

    const demoOrg = await Organization.create({
      name: 'Demo Company',
      slug: 'demo-company',
      email: 'demo@example.com',
      status: 'active'
    });

    const demoAdmin = await User.create({
      organizationId: demoOrg._id,
      email: 'demo@example.com',
      password: await bcrypt.hash('demo123', 10),
      name: 'Demo Admin',
      role: 'ORG_ADMIN',
      status: 'active'
    });

    const demoUser = await User.create({
      organizationId: demoOrg._id,
      email: 'user@example.com',
      password: await bcrypt.hash('user123', 10),
      name: 'Demo User',
      role: 'USER',
      status: 'active'
    });

    // Assign Free plan to demo org
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 10);

    await Subscription.create({
      organizationId: demoOrg._id,
      planId: freePlan._id,
      status: 'active',
      startDate: new Date(),
      endDate: subscriptionEndDate
    });

    console.log('✓ Demo organization created');
    console.log('  Org Admin - Email: demo@example.com, Password: demo123');
    console.log('  User - Email: user@example.com, Password: user123');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log('\nSuper Admin:');
    console.log('  Email: admin@system.local');
    console.log('  Password: admin123');
    console.log('\nDemo Organization Admin:');
    console.log('  Email: demo@example.com');
    console.log('  Password: demo123');
    console.log('\nDemo Organization User:');
    console.log('  Email: user@example.com');
    console.log('  Password: user123');
    console.log('\n========================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
