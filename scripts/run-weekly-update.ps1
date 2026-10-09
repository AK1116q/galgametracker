param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logRoot = Join-Path $repoRoot '.local\weekly-updates'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$latest = Join-Path $logRoot 'latest.json'
$runId = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$lock = $null
try {
    # Exclusive handle prevents concurrent/manual duplicate runs; no stale PID lock.
    $lock = [IO.File]::Open((Join-Path $logRoot 'run.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
    $codexPath = if ($codexCommand) { $codexCommand.Source } else {
        Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin') -Filter codex.exe -Recurse |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
    if (!$codexPath) { throw 'Codex CLI unavailable; open/update Codex and retry.' }
    Get-Command git, npm, npx -ErrorAction Stop | Out-Null
    $remote = & git -C $repoRoot remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^https://github\.com/AK1116q/galgametracker(?:\.git)?$') {
        throw 'Unexpected repository remote; stopped.'
    }
    # Verify existing ChatGPT login without copying credentials or using API billing.
    $ErrorActionPreference = 'Continue' # Windows PowerShell wraps native stderr as ErrorRecord.
    $loginOutput = & $codexPath login status 2>&1
    $loginCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($loginCode -ne 0 -or ($loginOutput -join ' ') -notmatch 'ChatGPT') {
        throw 'ChatGPT login unavailable; sign into Codex. No API-key fallback is allowed.'
    }
    $promptPath = Join-Path $repoRoot 'docs\weekly-update-prompt.md'
    $schemaPath = Join-Path $repoRoot 'scripts\weekly-update.schema.json'
    if (!(Test-Path -LiteralPath $promptPath) -or !(Test-Path -LiteralPath $schemaPath)) {
        throw 'Weekly update instructions missing.'
    }
    if ($CheckOnly) {
        @{ status = 'preflight-passed'; checkedAt = [DateTime]::UtcNow.ToString('o'); message = 'CLI, ChatGPT login and repository checked. No model invoked or content published.' } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'preflight.json') -Encoding UTF8
        exit 0
    }
    $anchor = [DateTimeOffset]'2026-10-16T09:00:00+11:00'
    $period = [Math]::Max(0, [Math]::Floor(([DateTimeOffset]::UtcNow - $anchor).TotalDays / 7))
    $cycleStart = $anchor.AddDays($period * 7).ToString('o')
    if (Test-Path -LiteralPath $latest) {
        $previous = Get-Content -LiteralPath $latest -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($previous.status -eq 'published' -and $previous.cycleStart -eq $cycleStart) { exit 0 }
    }
    & git -C $repoRoot fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }
    $worktree = Join-Path $repoRoot ".local\weekly-worktrees\$runId"
    & git -C $repoRoot worktree add -b "codex/weekly-$runId" $worktree origin/main
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated worktree.' }
    $resultPath = Join-Path $logRoot "$runId-result.json"
    @{ status = 'running'; cycleStart = $cycleStart; startedAt = [DateTime]::UtcNow.ToString('o'); worktree = $worktree } |
        ConvertTo-Json | Set-Content -LiteralPath $latest -Encoding UTF8
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = $utf8
    [Console]::OutputEncoding = $utf8
    # Use automatic approval review, not an unrestricted unattended process.
    $ErrorActionPreference = 'Continue'
    $runPrompt = "Update cycle starts $cycleStart and lasts 7 days. Across retries, publish at most two new works for this cycle; inspect committed update records first.`n`n" + (Get-Content -LiteralPath $promptPath -Raw -Encoding UTF8)
    $runPrompt |
        & $codexPath exec --approve-for-me -c 'web_search="live"' -C $worktree --output-schema $schemaPath -o $resultPath - 1> (Join-Path $logRoot "$runId-stdout.log") 2> (Join-Path $logRoot "$runId-stderr.log")
    $codexExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($codexExit -ne 0) { throw "Codex exited with code $codexExit; inspect this run's logs." }
    $result = Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($result.status -eq 'published' -and @($result.games).Count -ne 2) { throw 'Invalid published result: expected two works.' }
    @{ status = $result.status; games = $result.games; summary = $result.summary; cycleStart = $cycleStart; finishedAt = [DateTime]::UtcNow.ToString('o'); worktree = $worktree; resultFile = $resultPath } |
        ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $latest -Encoding UTF8
    if ($result.status -ne 'published') { exit 2 }
} catch {
    @{ status = 'blocked'; checkedAt = [DateTime]::UtcNow.ToString('o'); summary = $_.Exception.Message } |
        ConvertTo-Json | Set-Content -LiteralPath $latest -Encoding UTF8
    Write-Error $_ -ErrorAction Continue
    exit 1
} finally {
    if ($lock) { $lock.Dispose() }
}
