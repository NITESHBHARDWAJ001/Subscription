# ==================================================
# Super Admin Bootstrap - Test Commands (PowerShell)
# ==================================================
# 
# Usage: 
#   .\test-bootstrap.ps1
#
# ==================================================

$BASE_URL = "http://localhost:5000/api/system"
$SETUP_KEY = "a3f8d2e9c1b5a7f4e6d8c2b9a1f3e5d7c9b2a4f6e8d1c3b5a7f9e2d4c6b8a0f2"

Write-Host "=================================================="
Write-Host "Super Admin Bootstrap - Test Suite"
Write-Host "=================================================="
Write-Host ""

# Test 1: Check Bootstrap Status
Write-Host "Test 1: Checking bootstrap status..."
Write-Host ""
Invoke-RestMethod -Uri "$BASE_URL/bootstrap-status" -Method Get | ConvertTo-Json -Depth 10
Write-Host ""

# Test 2: Create Super Admin (Valid Request)
Write-Host "Test 2: Creating Super Admin with valid credentials..."
Write-Host ""
$body = @{
    email = "admin@system.com"
    password = "SuperAdmin123!"
    name = "System Administrator"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-setup-key" = $SETUP_KEY
}

try {
    Invoke-RestMethod -Uri "$BASE_URL/bootstrap-super-admin" -Method Post -Headers $headers -Body $body | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Response: $($_.Exception.Response.StatusCode.value__) - $($_.Exception.Message)"
    $_.Exception.Response.GetResponseStream() | ForEach-Object {
        $reader = New-Object System.IO.StreamReader($_)
        $reader.ReadToEnd()
    }
}
Write-Host ""

# Test 3: Try Invalid Setup Key
Write-Host "Test 3: Attempting with invalid setup key..."
Write-Host ""
$headers["x-setup-key"] = "wrong-key"
$body = @{
    email = "hacker@test.com"
    password = "Hacker123!"
    name = "Hacker"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$BASE_URL/bootstrap-super-admin" -Method Post -Headers $headers -Body $body | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected Error: $($_.Exception.Message)"
}
Write-Host ""

# Test 4: Try Creating Duplicate Super Admin
Write-Host "Test 4: Attempting to create duplicate Super Admin..."
Write-Host ""
$headers["x-setup-key"] = $SETUP_KEY
$body = @{
    email = "another@admin.com"
    password = "AnotherAdmin123!"
    name = "Another Admin"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$BASE_URL/bootstrap-super-admin" -Method Post -Headers $headers -Body $body | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected Error: $($_.Exception.Message)"
}
Write-Host ""

# Test 5: Check Bootstrap Status Again
Write-Host "Test 5: Checking bootstrap status after creation..."
Write-Host ""
Invoke-RestMethod -Uri "$BASE_URL/bootstrap-status" -Method Get | ConvertTo-Json -Depth 10
Write-Host ""

Write-Host "=================================================="
Write-Host "Test Suite Complete"
Write-Host "=================================================="
Write-Host ""
Write-Host "Now try logging in with:"
Write-Host "  Email: admin@system.com"
Write-Host "  Password: SuperAdmin123!"
Write-Host ""
