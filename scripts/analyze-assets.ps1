# Virtue Studio — Analyze Assets
# Scans and analyzes all assets in the assets/ directory

Write-Host "Virtue Studio — Asset Analysis" -ForegroundColor Red
Write-Host "========================================`n"

$assetDirs = @("assets/footage", "assets/images", "assets/audio", "assets/fonts")

foreach ($dir in $assetDirs) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -File
        Write-Host "${dir}: $($files.Count) files" -ForegroundColor Cyan
        foreach ($file in $files) {
            Write-Host "  - $($file.Name) ($([math]::Round($file.Length / 1MB, 2)) MB)"
        }
    } else {
        Write-Host "${dir}: not found" -ForegroundColor Yellow
    }
}

Write-Host "`nAsset analysis complete." -ForegroundColor Green
