param([string]$Name = 'game-activity-toggle')
$ErrorActionPreference = 'Stop'
if ($Name -notmatch '^[a-z0-9-]+$') { throw 'Invalid plugin name' }
$emberRoot = Split-Path -Parent $PSScriptRoot
$emberBundle = Join-Path $emberRoot "dist\$Name.js"
if (-not (Test-Path -LiteralPath $emberBundle)) { throw 'Run npm run build first' }
$emberTokenFile = Join-Path $env:LOCALAPPDATA 'DiscordPhoenix\sunbird\debug-shell-token'
if (-not (Test-Path -LiteralPath $emberTokenFile)) { throw 'Start Discord through Solaris first' }
$emberHeaders = @{ 'X-Sunbird-Token' = [IO.File]::ReadAllText($emberTokenFile).Trim() }
$emberSource = [IO.File]::ReadAllText($emberBundle)
Invoke-RestMethod -Uri "http://127.0.0.1:4242/plugins/$Name" -Method Put -Headers $emberHeaders -ContentType 'text/javascript; charset=utf-8' -Body $emberSource -TimeoutSec 15 | Out-Null
Write-Output "Installed $Name in the running Solaris session."
