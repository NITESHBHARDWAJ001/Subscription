#!/bin/bash

# ==================================================
# Super Admin Bootstrap - Test Commands
# ==================================================
# 
# Usage: 
#   chmod +x test-bootstrap.sh
#   ./test-bootstrap.sh
#
# Or run commands individually
# ==================================================

BASE_URL="http://localhost:5000/api/system"
SETUP_KEY="a3f8d2e9c1b5a7f4e6d8c2b9a1f3e5d7c9b2a4f6e8d1c3b5a7f9e2d4c6b8a0f2"

echo "=================================================="
echo "Super Admin Bootstrap - Test Suite"
echo "=================================================="
echo ""

# Test 1: Check Bootstrap Status
echo "Test 1: Checking bootstrap status..."
echo ""
curl -s -X GET "${BASE_URL}/bootstrap-status" | json_pp
echo ""
echo ""

# Test 2: Create Super Admin (Valid Request)
echo "Test 2: Creating Super Admin with valid credentials..."
echo ""
curl -s -X POST "${BASE_URL}/bootstrap-super-admin" \
  -H "Content-Type: application/json" \
  -H "x-setup-key: ${SETUP_KEY}" \
  -d '{
    "email": "admin@system.com",
    "password": "SuperAdmin123!",
    "name": "System Administrator"
  }' | json_pp
echo ""
echo ""

# Test 3: Try Invalid Setup Key
echo "Test 3: Attempting with invalid setup key..."
echo ""
curl -s -X POST "${BASE_URL}/bootstrap-super-admin" \
  -H "Content-Type: application/json" \
  -H "x-setup-key: wrong-key" \
  -d '{
    "email": "hacker@test.com",
    "password": "Hacker123!",
    "name": "Hacker"
  }' | json_pp
echo ""
echo ""

# Test 4: Try Creating Duplicate Super Admin
echo "Test 4: Attempting to create duplicate Super Admin..."
echo ""
curl -s -X POST "${BASE_URL}/bootstrap-super-admin" \
  -H "Content-Type: application/json" \
  -H "x-setup-key: ${SETUP_KEY}" \
  -d '{
    "email": "another@admin.com",
    "password": "AnotherAdmin123!",
    "name": "Another Admin"
  }' | json_pp
echo ""
echo ""

# Test 5: Check Bootstrap Status Again
echo "Test 5: Checking bootstrap status after creation..."
echo ""
curl -s -X GET "${BASE_URL}/bootstrap-status" | json_pp
echo ""
echo ""

echo "=================================================="
echo "Test Suite Complete"
echo "=================================================="
echo ""
echo "Now try logging in with:"
echo "  Email: admin@system.com"
echo "  Password: SuperAdmin123!"
echo ""
