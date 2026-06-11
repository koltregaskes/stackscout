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

Write-RefreshStatus -State 'running' -Message 'Stack Scout refresh started.' -Extra @{
  lastSuccessAt = $previousLastSuccessAt
}

Push-Location $repoRoot

try {
  Invoke-RefreshStep -Label 'Build Stack Scout' -ScriptBlock {
    & node 'scripts/build-stackscout.js'
  }

  if (-not $SkipCheck) {
    Invoke-RefreshStep -Label 'Check Stack Scout' -ScriptBlock {
      & cmd /c 'npm run check'
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
      # Scoped to public generated output only, so unrelated local work is
      # never swept into an automated commit. Filter to paths that actually
      # exist — `git add -- <missing>` aborts the whole add otherwise.
      $candidatePaths = @(
        'data', 'updates', 'tools', 'categories', 'collections', 'catalog',
        'radar', 'index.html', 'sitemap.xml'
      )
      $publishPaths = @($candidatePaths | Where-Object { Test-Path (Join-Path $repoRoot $_) })
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

      git push origin main
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
