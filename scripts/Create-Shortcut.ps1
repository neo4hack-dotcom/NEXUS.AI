# =====================================================================
#  NEXUS.AI - Desktop shortcut creator (Windows)
#  Drops a "NEXUS.AI" shortcut on the current user's Desktop that
#  launches start.bat from the project root.
# =====================================================================
[CmdletBinding()]
param(
    [string]$ShortcutName = "NEXUS.AI"
)

$ErrorActionPreference = "Stop"

try {
    # Resolve the project root (parent of /scripts)
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $Target      = Join-Path $ProjectRoot "start.bat"
    $IconPath    = Join-Path $ProjectRoot "scripts\nexus-ai.ico"

    if (-not (Test-Path $Target)) {
        Write-Host "[ERROR] start.bat not found at $Target" -ForegroundColor Red
        exit 1
    }

    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $LinkPath    = Join-Path $DesktopPath ("$ShortcutName.lnk")

    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($LinkPath)
    $Shortcut.TargetPath       = $Target
    $Shortcut.WorkingDirectory = $ProjectRoot
    $Shortcut.WindowStyle      = 1
    $Shortcut.Description      = "NEXUS.AI - AI Project Operations Platform"
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = $IconPath
    }
    $Shortcut.Save()

    Write-Host ""
    Write-Host "[OK] Desktop shortcut created:" -ForegroundColor Green
    Write-Host "     $LinkPath"
    Write-Host ""
}
catch {
    Write-Host "[ERROR] Could not create shortcut: $_" -ForegroundColor Red
    exit 1
}
