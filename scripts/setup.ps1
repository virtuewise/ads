# PrintSync Creative OS — Setup Script
# Run this script to set up the development environment

Write-Host "PrintSync Creative OS — Setup" -ForegroundColor Red
Write-Host "================================`n"

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Cyan
$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "Node.js not found. Please install Node.js 20+." -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js $nodeVersion`n"

# Check pnpm
Write-Host "Checking pnpm..." -ForegroundColor Cyan
$pnpmVersion = pnpm --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "  pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm@9
}
Write-Host "  pnpm $pnpmVersion`n"

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pnpm install
Write-Host "  Dependencies installed`n"

# Build packages
Write-Host "Building packages..." -ForegroundColor Cyan
pnpm build
Write-Host "  Build complete`n"

Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Run 'pnpm ads:daily' to generate your first advert.`n"
