[CmdletBinding()]
param(
  [switch]$SkipCheck
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$privateDataDir = $null
$privateDataDirInput = if ($env:STACKSCOUT_PRIVATE_STATUS_DIR) {
  $env:STACKSCOUT_PRIVATE_STATUS_DIR
} elseif ($env:STACKSCOUT_PRIVATE_EXPORT_DIR) {
  $env:STACKSCOUT_PRIVATE_EXPORT_DIR
} else {
  $null
}

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

Write-RefreshStatus -State 'running' -Message 'StackScout refresh started.' -Extra @{
  lastSuccessAt = $previousLastSuccessAt
}

Push-Location $repoRoot

try {
  Invoke-RefreshStep -Label 'Build StackScout' -ScriptBlock {
    & node 'scripts/build-stackscout.js'
  }

  if (-not $SkipCheck) {
    Invoke-RefreshStep -Label 'Check StackScout' -ScriptBlock {
      & cmd /c 'npm run check'
    }
  }

  $toolsManifest = Read-JsonFile -Path $toolsManifestFile
  $updatesManifest = Read-JsonFile -Path $updatesManifestFile
  $categoriesManifest = Read-JsonFile -Path $categoriesManifestFile

  if (-not $toolsManifest) {
    throw 'StackScout refresh completed but tools-manifest.json could not be read.'
  }

  $durationStopwatch.Stop()
  $completedAt = (Get-Date).ToUniversalTime().ToString('o')

  Write-RefreshStatus -State 'ok' -Message 'StackScout refresh completed successfully.' -Extra @{
    completedAt = $completedAt
    lastSuccessAt = $completedAt
    durationMs = [int][Math]::Round($durationStopwatch.Elapsed.TotalMilliseconds)
    generatedAt = $toolsManifest.generatedAt
    toolCount = [int]($toolsManifest.counts.total)
    updateCount = [int]((@($updatesManifest.items)).Count)
    categoryCount = [int]((@($categoriesManifest.categories)).Count)
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
