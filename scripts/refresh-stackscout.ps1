[CmdletBinding()]
param(
  [switch]$SkipCheck,
  # Opt-in publish leg: commit + push generated public output to main so the
  # live GitHub Pages site actually receives refreshed data. Without this the
  # refresh only writes files locally — digests were piling up untracked and
  # the deployed site never saw them. Off by default; enable by adding
  # -Publish to the scheduled task action once approved.
  [switch]$Publish
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$privateDataDirInput = if ($env:STACKSCOUT_PRIVATE_STATUS_DIR) {
  $env:STACKSCOUT_PRIVATE_STATUS_DIR
} elseif ($env:STACKSCOUT_PRIVATE_EXPORT_DIR) {
  $env:STACKSCOUT_PRIVATE_EXPORT_DIR
} else {
  $null
}

$privateDataDir = $null
if ($privateDataDirInput) {
  if (-not (Test-Path $privateDataDirInput)) {
    New-Item -ItemType Directory -Path $privateDataDirInput -Force | Out-Null
  }

  $privateDataDir = (Resolve-Path $privateDataDirInput).Path
}

$statusFile = if ($privateDataDir) { Join-Path $privateDataDir 'stackscout-refresh-status.json' } else { $null }
$toolsManifestFile = Join-Path $repoRoot 'data\tools-manifest.json'
$updatesManifestFile = Join-Path $repoRoot 'data\updates-manifest.json'
$categoriesManifestFile = Join-Path $repoRoot 'data\categories-manifest.json'
$publishCandidatePaths = @(
  'data', 'updates', 'tools', 'categories', 'collections', 'catalog',
  'radar', 'method', 'index.html', 'sitemap.xml', 'service-worker.js',
  'llms.txt'
)
$startedAt = (Get-Date).ToUniversalTime().ToString('o')
$steps = New-Object System.Collections.Generic.List[object]
$durationStopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Read-JsonFile {
  param(
    [string]$Path
  )

  if (-not $Path) {
    return $null
  }

  if (-not (Test-Path $Path)) {
    return $null
  }

  try {
    return (Get-Content -Path $Path -Raw -Encoding UTF8) | ConvertFrom-Json
  } catch {
    return $null
  }
}

$previousStatus = Read-JsonFile -Path $statusFile
$previousLastSuccessAt = if ($previousStatus) { $previousStatus.lastSuccessAt } else { $null }

function Write-RefreshStatus {
  param(
    [Parameter(Mandatory = $true)]
    [string]$State,
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [hashtable]$Extra = @{}
  )

  $payload = @{}
  $payload['state'] = $State
  $payload['message'] = $Message
  $payload['startedAt'] = $startedAt
  $payload['updatedAt'] = (Get-Date).ToUniversalTime().ToString('o')
  $payload['repoRoot'] = $repoRoot
  $payload['skipCheck'] = [bool]$SkipCheck
  $stepRecords = @()
  foreach ($step in $steps) {
    $stepRecords += $step
  }
  $payload['steps'] = $stepRecords

  foreach ($entry in $Extra.GetEnumerator()) {
    $payload[$entry.Key] = $entry.Value
  }

  if (-not $statusFile) {
    return
  }

  $directory = Split-Path -Parent $statusFile
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $json = ([pscustomobject]$payload) | ConvertTo-Json -Depth 8
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($statusFile, $json, $utf8NoBom)
}

function Invoke-RefreshStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$ScriptBlock
  )

  $stepWatch = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    & $ScriptBlock
    $stepWatch.Stop()
    $steps.Add([ordered]@{
      label = $Label
      state = 'ok'
      durationMs = [int][Math]::Round($stepWatch.Elapsed.TotalMilliseconds)
    })
    Write-RefreshStatus -State 'running' -Message "Completed $Label."
  } catch {
    $stepWatch.Stop()
    $steps.Add([ordered]@{
      label = $Label
      state = 'error'
      durationMs = [int][Math]::Round($stepWatch.Elapsed.TotalMilliseconds)
      error = $_.Exception.Message
    })
    throw
  }
}

function Invoke-GitText {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  $output = @(& git @Arguments)
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage Git exited with code $LASTEXITCODE."
  }

  return (($output -join "`n").Trim())
}

function Test-IsPublishPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $normalisedPath = $Path.Replace('\', '/').Trim('"')
  foreach ($candidate in $publishCandidatePaths) {
    $normalisedCandidate = $candidate.Replace('\', '/')
    if (
      $normalisedPath -ceq $normalisedCandidate -or
      $normalisedPath.StartsWith("$normalisedCandidate/", [System.StringComparison]::Ordinal)
    ) {
      return $true
    }
  }

  return $false
}

function Get-UnexpectedPublishChanges {
  $statusLines = @(& git status --porcelain=v1 --untracked-files=all)
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed with exit code $LASTEXITCODE."
  }

  $unexpected = New-Object System.Collections.Generic.List[string]
  foreach ($line in $statusLines) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) {
      continue
    }

    $path = $line.Substring(3)
    if ($path.Contains(' -> ')) {
      $path = ($path -split ' -> ')[-1]
    }

    if (-not (Test-IsPublishPath -Path $path)) {
      $unexpected.Add($path)
    }
  }

  return @($unexpected)
}

function Assert-PublishCheckoutReady {
  $branch = Invoke-GitText -Arguments @('branch', '--show-current') -FailureMessage 'Could not read the current branch.'
  if ($branch -ne 'main') {
    throw "Publishing is only allowed from the main branch. Current branch: '$branch'."
  }

  & git diff --cached --quiet
  if ($LASTEXITCODE -eq 1) {
    throw 'Publishing refused because the Git index already contains staged changes. The scheduled publisher only stages its own allow-listed generated output.'
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Could not verify that the Git index is clean. git diff exited with code $LASTEXITCODE."
  }

  $unexpected = @(Get-UnexpectedPublishChanges)
  if ($unexpected.Count -gt 0) {
    throw "Publishing refused because non-generated worktree changes exist: $($unexpected -join ', ')."
  }

  Invoke-GitText -Arguments @('fetch', '--no-tags', 'origin', 'main') -FailureMessage 'Could not fetch origin/main before publishing.' | Out-Null

  $head = Invoke-GitText -Arguments @('rev-parse', 'HEAD') -FailureMessage 'Could not read local HEAD.'
  $originHead = Invoke-GitText -Arguments @('rev-parse', 'origin/main') -FailureMessage 'Could not read origin/main.'
  if ($head -ne $originHead) {
    $counts = Invoke-GitText -Arguments @('rev-list', '--left-right', '--count', 'HEAD...origin/main') -FailureMessage 'Could not compare local main with origin/main.'
    throw "Publishing refused because local main is not exactly current with origin/main (ahead/behind: $counts). Reconcile it without reset or force-push, then retry."
  }

  return $originHead
}

function Assert-PublishRemoteUnchanged {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedCommit
  )

  Invoke-GitText -Arguments @('fetch', '--no-tags', 'origin', 'main') -FailureMessage 'Could not re-fetch origin/main before committing.' | Out-Null
  $currentOriginHead = Invoke-GitText -Arguments @('rev-parse', 'origin/main') -FailureMessage 'Could not re-read origin/main.'
  if ($currentOriginHead -ne $ExpectedCommit) {
    throw "Publishing stopped before commit because origin/main moved from $ExpectedCommit to $currentOriginHead during the refresh."
  }
}

Write-RefreshStatus -State 'running' -Message 'Stack Scout refresh started.' -Extra @{
  lastSuccessAt = $previousLastSuccessAt
}

Push-Location $repoRoot

try {
  $publishBaseCommit = $null
  if ($Publish) {
    Invoke-RefreshStep -Label 'Preflight publish checkout' -ScriptBlock {
      $script:publishBaseCommit = Assert-PublishCheckoutReady
    }
  }

  Invoke-RefreshStep -Label 'Build Stack Scout' -ScriptBlock {
    & node 'scripts/build-stackscout.js'
    if ($LASTEXITCODE -ne 0) {
      throw "Stack Scout build failed with exit code $LASTEXITCODE."
    }
  }

  if (-not $SkipCheck) {
    Invoke-RefreshStep -Label 'Check Stack Scout' -ScriptBlock {
      & cmd /c 'npm run check'
      if ($LASTEXITCODE -ne 0) {
        throw "Stack Scout checks failed with exit code $LASTEXITCODE."
      }
    }
  }

  $toolsManifest = Read-JsonFile -Path $toolsManifestFile
  $updatesManifest = Read-JsonFile -Path $updatesManifestFile
  $categoriesManifest = Read-JsonFile -Path $categoriesManifestFile

  if (-not $toolsManifest) {
    throw 'Stack Scout refresh completed but tools-manifest.json could not be read.'
  }

  $publishedCommit = $null
  if ($Publish) {
    Invoke-RefreshStep -Label 'Publish generated output' -ScriptBlock {
      Assert-PublishRemoteUnchanged -ExpectedCommit $publishBaseCommit

      # Scoped to public generated output only, so unrelated local work is
      # never swept into an automated commit. Filter to paths that actually
      # exist — `git add -- <missing>` aborts the whole add otherwise.
      $publishPaths = @($publishCandidatePaths | Where-Object { Test-Path (Join-Path $repoRoot $_) })
      if ($publishPaths.Count -eq 0) {
        return
      }

      $changes = @(git status --porcelain -- $publishPaths)
      if ($LASTEXITCODE -ne 0) {
        throw "git status failed with exit code $LASTEXITCODE."
      }

      if ($changes.Count -eq 0) {
        return
      }

      git add -- $publishPaths
      if ($LASTEXITCODE -ne 0) {
        throw "git add failed with exit code $LASTEXITCODE."
      }

      $staged = @(git diff --cached --name-only)
      if ($staged.Count -eq 0) {
        return
      }

      $commitMessage = "chore: publish Stack Scout refresh $((Get-Date).ToString('yyyy-MM-dd')) [automated]"
      git commit -m $commitMessage
      if ($LASTEXITCODE -ne 0) {
        throw "git commit failed with exit code $LASTEXITCODE."
      }

      git push origin HEAD:main
      if ($LASTEXITCODE -ne 0) {
        throw "git push failed with exit code $LASTEXITCODE. The commit remains local."
      }

      $script:publishedCommit = (git rev-parse --short HEAD)
    }
  }

  $durationStopwatch.Stop()
  $completedAt = (Get-Date).ToUniversalTime().ToString('o')

  Write-RefreshStatus -State 'ok' -Message 'Stack Scout refresh completed successfully.' -Extra @{
    completedAt = $completedAt
    lastSuccessAt = $completedAt
    durationMs = [int][Math]::Round($durationStopwatch.Elapsed.TotalMilliseconds)
    generatedAt = $toolsManifest.generatedAt
    toolCount = [int]($toolsManifest.counts.total)
    updateCount = [int]((@($updatesManifest.items)).Count)
    categoryCount = [int]((@($categoriesManifest.categories)).Count)
    publishEnabled = [bool]$Publish
    publishBaseCommit = $publishBaseCommit
    publishedCommit = $publishedCommit
  }
} catch {
  $durationStopwatch.Stop()
  Write-RefreshStatus -State 'error' -Message $_.Exception.Message -Extra @{
    failedAt = (Get-Date).ToUniversalTime().ToString('o')
    lastSuccessAt = $previousLastSuccessAt
    durationMs = [int][Math]::Round($durationStopwatch.Elapsed.TotalMilliseconds)
  }
  throw
} finally {
  Pop-Location
}
