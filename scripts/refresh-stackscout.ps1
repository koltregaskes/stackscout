[CmdletBinding()]
param(
  [switch]$SkipCheck
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$privateDataDirCandidates = @(
  'W:\Repos\_local\surfaces\tools-hub-local\data',
  '\\nas_storage_1\Workspaces\Repos\_local\surfaces\tools-hub-local\data'
)
$privateDataDir = $null
foreach ($candidate in $privateDataDirCandidates) {
  try {
    if (-not (Test-Path $candidate)) {
      New-Item -ItemType Directory -Path $candidate -Force | Out-Null
    }

    $privateDataDir = (Resolve-Path $candidate).Path
    break
  } catch {
    continue
  }
}

if (-not $privateDataDir) {
  throw 'Unable to resolve a writable private data directory for Stack Scout refresh status.'
}

$statusFile = Join-Path $privateDataDir 'stackscout-refresh-status.json'
$toolsManifestFile = Join-Path $repoRoot 'data\tools-manifest.json'
$updatesManifestFile = Join-Path $repoRoot 'data\updates-manifest.json'
$categoriesManifestFile = Join-Path $repoRoot 'data\categories-manifest.json'
$startedAt = (Get-Date).ToUniversalTime().ToString('o')
$steps = New-Object System.Collections.Generic.List[object]
$durationStopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Read-JsonFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

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
