# Virtue Studio — Render Film
# Renders a PrintSync brand film using Remotion

param(
    [string]$Composition = "PrintSyncBrandFilm",
    [string]$Output = "renders/printsync-brand-film.mp4"
)

Write-Host "Virtue Studio — Render Film" -ForegroundColor Red
Write-Host "=====================================`n"

Write-Host "Composition: $Composition" -ForegroundColor Cyan
Write-Host "Output: $Output`n"

# Ensure output directory exists
$outputDir = Split-Path $Output -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Render
Push-Location apps\renderer
pnpm remotion render $Composition $Output
Pop-Location

Write-Host "`nRender complete: $Output" -ForegroundColor Green
