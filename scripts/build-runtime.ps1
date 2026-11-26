$ErrorActionPreference = 'Stop'
$emberRoot = Split-Path -Parent $PSScriptRoot
$emberConfig = Get-Content -LiteralPath (Join-Path $emberRoot 'runtime\sunbird.json') -Raw | ConvertFrom-Json
$emberRuntime = Join-Path $emberRoot '.runtime'
$emberSource = Join-Path $emberRuntime 'source'
New-Item -ItemType Directory -Path $emberRuntime -Force | Out-Null
if (-not (Test-Path -LiteralPath $emberSource)) {
    git init $emberSource
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the runtime source directory' }
    git -C $emberSource remote add origin $emberConfig.repository
    git -C $emberSource fetch --depth 1 origin $emberConfig.commit
    if ($LASTEXITCODE -ne 0) { throw 'Could not fetch the pinned Sunbird source' }
    git -C $emberSource checkout --detach FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Could not check out the pinned Sunbird source' }
}
$emberHead = git -C $emberSource rev-parse HEAD
if ($emberHead -ne $emberConfig.commit) { throw 'Runtime source is on a different commit; use a separate directory' }
$emberPatch = Join-Path $emberRoot $emberConfig.patch
git -C $emberSource apply --reverse --check $emberPatch 2>$null
if ($LASTEXITCODE -ne 0) {
    git -C $emberSource apply --check $emberPatch
    if ($LASTEXITCODE -ne 0) { throw 'Runtime patch does not apply cleanly' }
    git -C $emberSource apply $emberPatch
    if ($LASTEXITCODE -ne 0) { throw 'Could not apply the runtime patch' }
}
Push-Location $emberSource
try {
    cargo build --release -p phoenix-loader -p phoenix-inject
    if ($LASTEXITCODE -ne 0) { throw 'Runtime build failed. Install Rust and Visual Studio C++ Build Tools first.' }
    Copy-Item -LiteralPath 'target\release\phoenix.dll' -Destination $emberRuntime
    Copy-Item -LiteralPath 'target\release\phoenix-inject.exe' -Destination $emberRuntime
} finally { Pop-Location }
Write-Output 'Runtime built. Close Phoenix, then run start-phoenix.cmd.'
