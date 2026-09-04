param(
  [ValidateSet('init', 'start', 'stop', 'restart', 'status', 'url')]
  [string]$Command = 'status',
  [string]$DatabaseName = 'sgmv_local',
  [string]$DatabaseUser = 'sgmv',
  [int]$Port = 55432,
  [string]$DataDir = "$env:LOCALAPPDATA\SGMV\postgres-18-data",
  [string]$LogFile = "$env:LOCALAPPDATA\SGMV\postgres-18.log"
)

$ErrorActionPreference = 'Stop'

$postgresBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$initdb = Join-Path $postgresBin 'initdb.exe'
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$pgIsReady = Join-Path $postgresBin 'pg_isready.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'

function Assert-PostgresBinary {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "No se encontro $Path. Instala PostgreSQL 18 o ajusta scripts/db-local.ps1."
  }
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Fallo el comando: $FilePath $($Arguments -join ' ')"
  }
}

function Get-DatabaseUrl {
  'postgresql://{0}@localhost:{1}/{2}?schema=public' -f $DatabaseUser, $Port, $DatabaseName
}

function Test-ClusterInitialized {
  Test-Path -LiteralPath (Join-Path $DataDir 'PG_VERSION')
}

function Test-ServerReady {
  & $pgIsReady -h localhost -p $Port -q
  $LASTEXITCODE -eq 0
}

function Wait-ServerReady {
  $deadline = (Get-Date).AddSeconds(30)

  while ((Get-Date) -lt $deadline) {
    if (Test-ServerReady) {
      return
    }

    Start-Sleep -Milliseconds 500
  }

  throw "PostgreSQL local no respondio en localhost:$Port."
}

function Initialize-Cluster {
  Assert-PostgresBinary $initdb

  if (Test-ClusterInitialized) {
    Write-Host "Cluster local ya inicializado: $DataDir"
    return
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $DataDir) | Out-Null

  Invoke-Checked $initdb @(
    '-D', $DataDir,
    '-U', $DatabaseUser,
    '-A', 'trust',
    '-E', 'UTF8',
    '--locale=C'
  )

  Write-Host "Cluster local inicializado: $DataDir"
}

function Start-Cluster {
  Assert-PostgresBinary $pgCtl
  Assert-PostgresBinary $pgIsReady

  Initialize-Cluster

  if (Test-ServerReady) {
    Write-Host "PostgreSQL local ya esta activo en localhost:$Port"
    return
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null

  Invoke-Checked $pgCtl @(
    '-D', $DataDir,
    '-l', $LogFile,
    '-o', "-p $Port",
    '-w',
    'start'
  )

  Wait-ServerReady
  Write-Host "PostgreSQL local activo en localhost:$Port"
}

function Stop-Cluster {
  Assert-PostgresBinary $pgCtl

  if (-not (Test-ClusterInitialized)) {
    Write-Host "Cluster local no inicializado."
    return
  }

  & $pgCtl -D $DataDir status | Out-Null

  if ($LASTEXITCODE -ne 0) {
    Write-Host "PostgreSQL local no esta activo."
    return
  }

  Invoke-Checked $pgCtl @('-D', $DataDir, '-m', 'fast', '-w', 'stop')
  Write-Host "PostgreSQL local detenido."
}

function Ensure-Database {
  Assert-PostgresBinary $psql
  Assert-PostgresBinary $createdb

  $exists = & $psql -h localhost -p $Port -U $DatabaseUser -d postgres -tAc "select 1 from pg_database where datname = '$DatabaseName'"

  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar la base local."
  }

  $existsText = if ($null -eq $exists) { '' } else { ($exists | Out-String).Trim() }

  if ($existsText -eq '1') {
    Write-Host "Base local ya existe: $DatabaseName"
    return
  }

  Invoke-Checked $createdb @('-h', 'localhost', '-p', "$Port", '-U', $DatabaseUser, $DatabaseName)
  Write-Host "Base local creada: $DatabaseName"
}

function Show-Status {
  if (-not (Test-ClusterInitialized)) {
    Write-Host "Cluster local no inicializado: $DataDir"
    return
  }

  if (Test-ServerReady) {
    Write-Host "PostgreSQL local activo en localhost:$Port"
    Write-Host "DATABASE_URL=$(Get-DatabaseUrl)"
    return
  }

  Write-Host "Cluster local inicializado, pero servidor detenido."
}

Assert-PostgresBinary $initdb
Assert-PostgresBinary $pgCtl
Assert-PostgresBinary $pgIsReady
Assert-PostgresBinary $psql
Assert-PostgresBinary $createdb

switch ($Command) {
  'init' {
    Start-Cluster
    Ensure-Database
    Write-Host "DATABASE_URL=$(Get-DatabaseUrl)"
  }
  'start' {
    Start-Cluster
    Ensure-Database
  }
  'stop' {
    Stop-Cluster
  }
  'restart' {
    Stop-Cluster
    Start-Cluster
    Ensure-Database
  }
  'status' {
    Show-Status
  }
  'url' {
    Write-Host "DATABASE_URL=$(Get-DatabaseUrl)"
  }
}
