param(
    [Parameter(Mandatory = $true)][DateTimeOffset]$FirstRun,
    [switch]$PreflightOnly
)
$ErrorActionPreference = 'Stop'
$taskName = 'GalgameTracker-Weekly2'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runner = Join-Path $PSScriptRoot 'run-weekly-update.ps1'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $runner + '"'
if ($PreflightOnly) { $arguments += ' -CheckOnly' }
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument $arguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Once -At $FirstRun.LocalDateTime -RepetitionInterval (New-TimeSpan -Days 7)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and $existing.Description -ne "Weekly two-work update for AK1116q/galgametracker ($repoRoot)") {
    throw 'A different task already uses this name; it was not replaced.'
}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Weekly two-work update for AK1116q/galgametracker ($repoRoot)" -Force | Select-Object TaskName, State
