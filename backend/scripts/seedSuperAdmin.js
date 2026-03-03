/**
 * Secure Super Admin Seed Script
 * 
 * Usage:
 *   node scripts/seedSuperAdmin.js
 * 
 * This script:
 * - Checks if SUPER_ADMIN already exists
 * - Creates one if missing, using environment credentials
 * - Is idempotent (safe to run multiple times)
 * 
 * Required Environment Variables:
 * - SUPER_ADMIN_EMAIL
 * - SUPER_ADMIN_PASSWORD
 * - SUPER_ADMIN_NAME
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');

const seedSuperAdmin = async () => {
  try {
    console.log('🔐 Super Admin Seed Script Starting...\n');

    // Connect to database
    await connectDB();
    console.log('✓ Connected to database\n');

    // ------------------------------------
    // CHECK IF SUPER ADMIN ALREADY EXISTS
    // ------------------------------------
    const existingSuperAdmin = await User.findOne({ role: 'SUPER_ADMIN' });

    if (existingSuperAdmin) {
      console.log('ℹ️  Super Admin already exists:');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log(`   Created: ${existingSuperAdmin.createdAt}\n`);
      console.log('✓ No action needed. Exiting.\n');
      process.exit(0);
    }

    console.log('⚠️  No Super Admin found. Creating...\n');

    // ------------------------------------
    // VALIDATE ENVIRONMENT VARIABLES
    // ------------------------------------
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME;

    if (!email || !password || !name) {
      console.error('❌ ERROR: Missing required environment variables\n');
      console.error('Required:');
      console.error('  - SUPER_ADMIN_EMAIL');
      console.error('  - SUPER_ADMIN_PASSWORD');
      console.error('  - SUPER_ADMIN_NAME\n');
      console.error('Please add these to your .env file and try again.\n');
      process.exit(1);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ ERROR: Invalid email format\n');
      process.exit(1);
    }

    // Password strength validation
    if (password.length < 8) {
      console.error('❌ ERROR: Password must be at least 8 characters long\n');
      process.exit(1);
    }

    // Check if email is already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error(`❌ ERROR: Email ${email} is already registered\n`);
      process.exit(1);
    }

    // ------------------------------------
    // CREATE SUPER ADMIN ORGANIZATION
    // ------------------------------------
    console.log('Creating System Administration organization...');
    
    const superAdminOrg = await Organization.create({
      name: 'System Administration',
      slug: 'system-admin',
      status: 'active'
    });

    console.log('✓ Organization created\n');

    // ------------------------------------
    // HASH PASSWORD
    // ------------------------------------
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✓ Password hashed\n');

    // ------------------------------------
    // CREATE SUPER ADMIN USER
    // ------------------------------------
    console.log('Creating Super Admin user...');
    
    const superAdmin = await User.create({
      organizationId: superAdminOrg._id,
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN', // HARDCODED role
      status: 'active'
    });

    console.log('✓ Super Admin created successfully!\n');

    // ------------------------------------
    // DISPLAY RESULTS
    // ------------------------------------
    console.log('═══════════════════════════════════════════');
    console.log('Super Admin Details:');
    console.log('═══════════════════════════════════════════');
    console.log(`Name:         ${superAdmin.name}`);
    console.log(`Email:        ${superAdmin.email}`);
    console.log(`Role:         ${superAdmin.role}`);
    console.log(`Organization: ${superAdminOrg.name}`);
    console.log(`Created:      ${superAdmin.createdAt}`);
    console.log('═══════════════════════════════════════════\n');

    console.log('✅ Super Admin seed completed successfully!\n');
    console.log('You can now login with:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Password: [the one you set in .env]\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ SEED FAILED:', error.message);
    console.error('\nStack Trace:');
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the seed
seedSuperAdmin();
