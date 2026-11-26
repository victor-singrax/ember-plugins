$ErrorActionPreference = 'Stop'
$emberRoot = Split-Path -Parent $PSScriptRoot
$emberRuntime = Join-Path $emberRoot '.runtime'
$emberLauncher = Join-Path $emberRuntime 'phoenix-inject.exe'
$emberDll = Join-Path $emberRuntime 'phoenix.dll'
if (-not (Test-Path -LiteralPath $emberLauncher) -or -not (Test-Path -LiteralPath $emberDll)) {
    throw 'Build the Ember runtime first with scripts\build-runtime.ps1.'
}
$emberShell = New-Object -ComObject WScript.Shell
$emberFolders = @{
    desktop = [Environment]::GetFolderPath('Desktop')
    'start-menu' = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    taskbar = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
}
$emberStockLauncher = Join-Path $env:LOCALAPPDATA 'Sunbird\sunbird.exe'
$emberDiscord = Join-Path $env:LOCALAPPDATA 'DiscordPhoenix\app\Discord.exe'
foreach ($emberFolder in $emberFolders.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath $emberFolder.Value)) { continue }
    foreach ($emberFile in Get-ChildItem -LiteralPath $emberFolder.Value -Filter '*.lnk') {
        $emberShortcut = $emberShell.CreateShortcut($emberFile.FullName)
        if ($emberShortcut.TargetPath -notin @($emberStockLauncher, $emberDiscord, $emberLauncher)) { continue }
        if ($emberShortcut.TargetPath -eq $emberLauncher -and $emberShortcut.Arguments -eq ('"' + $emberDll + '"')) {
            Write-Output ('Already configured: ' + $emberFile.FullName)
            continue
        }
        $emberBackupFolder = Join-Path $emberRuntime ('shortcut-backups\' + $emberFolder.Key)
        New-Item -ItemType Directory -Path $emberBackupFolder -Force | Out-Null
        $emberBackup = Join-Path $emberBackupFolder $emberFile.Name
        if (-not (Test-Path -LiteralPath $emberBackup)) {
            Copy-Item -LiteralPath $emberFile.FullName -Destination $emberBackup
        }
        $emberShortcut.TargetPath = $emberLauncher
        $emberShortcut.Arguments = '"' + $emberDll + '"'
        $emberShortcut.WorkingDirectory = $emberRoot
        $emberShortcut.Description = 'Discord Phoenix with the Ember Sunbird runtime extension'
        $emberShortcut.IconLocation = $emberDiscord + ',0'
        $emberShortcut.Save()
        Write-Output ('Configured: ' + $emberFile.FullName)
    }
}
