# Firebase Hosting static deploy — only explicitly chosen public assets.
# No student data, local backups or auth secrets may be staged or uploaded.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required. Install Node.js LTS from https://nodejs.org and retry.'
}
$target = Join-Path $PSScriptRoot '.firebase-deploy-safe-public'
if (Test-Path -LiteralPath $target) {
  throw "Safety: staging directory already exists. Review and manually remove it before re-running: $target"
}
New-Item -ItemType Directory -Path $target | Out-Null
$publicFiles = @('index.html','migration.html','styles.css','app.js','migration.js',
    'firebase-sync.js','config.js','pdf-export.js','service-worker.js','manifest.webmanifest','robots.txt')
foreach ($file in $publicFiles) {
  $source = Join-Path $PSScriptRoot $file
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing public asset: $file" }
  Copy-Item -LiteralPath $source -Destination $target
}
$icons = Join-Path $PSScriptRoot 'icons'
if (-not (Test-Path -LiteralPath $icons -PathType Container)) { throw 'Missing icons directory' }
Copy-Item -LiteralPath $icons -Destination $target -Recurse
Write-Host 'Only approved static app files have been staged; no backup JSON or student data included.'
Write-Host 'A browser login with the Firebase project owner may be required.'
npx --yes firebase-tools@latest login
if ($LASTEXITCODE -ne 0) { throw 'Firebase login failed; nothing deployed.' }
npx --yes firebase-tools@latest deploy --only hosting --project student-guidance2
if ($LASTEXITCODE -ne 0) { throw 'Firebase Hosting deploy failed.' }
Write-Host 'Deployment complete. Open https://student-guidance2.web.app/'
