$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$androidDir = Join-Path $projectRoot "android"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
$appConfig = Get-Content -Path (Join-Path $projectRoot "app.json") -Raw | ConvertFrom-Json
$version = $appConfig.expo.version
$copyDir = Join-Path $projectRoot "release-apk"
$copyPath = Join-Path $copyDir "TinyMD-$version-release.apk"

Write-Host ""
Write-Host "TinyMD release build starting..." -ForegroundColor Cyan

Push-Location $androidDir
try {
  $env:NODE_ENV = "production"
  & .\gradlew.bat assembleRelease -x lintVitalAnalyzeRelease
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle release build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if (!(Test-Path $apkPath)) {
  throw "Release APK not found: $apkPath"
}

New-Item -ItemType Directory -Force -Path $copyDir | Out-Null
Copy-Item -Path $apkPath -Destination $copyPath -Force

Write-Host ""
Write-Host "Build completed." -ForegroundColor Green
Write-Host "APK:"
Write-Host "  $apkPath"
Write-Host "Copied:"
Write-Host "  $copyPath"
