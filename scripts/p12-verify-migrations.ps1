param(
  [string]$Port = '55432',
  [string]$DatabaseUser = 'sgmv',
  [string]$BaseDatabase = 'sgmv_local',
  [string]$PreviousCommit = '2c27c7f1a603e31115e7101cb60442de07ff20de',
  [string]$Suffix = (Get-Date -Format 'yyyyMMddHHmmss')
)

$ErrorActionPreference = 'Stop'
$postgresBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$createdb = Join-Path $postgresBin 'createdb.exe'
$dropdb = Join-Path $postgresBin 'dropdb.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$prisma = Join-Path (Get-Location) 'src\backend\node_modules\.bin\prisma.cmd'

foreach ($path in @($createdb, $dropdb, $psql, $prisma)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "No se encontro la herramienta requerida: $path"
  }
}

if ($Suffix -notmatch '^[A-Za-z0-9]+$') {
  throw 'Suffix invalido: solo se permiten caracteres alfanumericos.'
}

$currentCommit = (& git rev-parse HEAD | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $currentCommit -ne $PreviousCommit) {
  throw "La base de comparacion debe provenir de la linea P11 $PreviousCommit; HEAD actual: $currentCommit"
}

$zeroDatabase = "sgmv_p12_zero_$Suffix"
$previousDatabase = "sgmv_p12_previous_$Suffix"
$databaseNames = @($zeroDatabase, $previousDatabase)

function Invoke-Checked {
  param([string]$FilePath, [string[]]$Arguments)
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo el comando: $FilePath $($Arguments -join ' ')"
  }
}

function New-Database {
  param([string]$Name, [string]$Template)
  $args = @('-h', 'localhost', '-p', $Port, '-U', $DatabaseUser)
  if ($Template) { $args += @('-T', $Template) }
  $args += $Name
  Invoke-Checked $createdb $args
}

function Get-MigrationCount {
  param([string]$Name)
  $result = & $psql -h localhost -p $Port -U $DatabaseUser -d $Name -tAc "select count(*) from _prisma_migrations where finished_at is not null"
  if ($LASTEXITCODE -ne 0) { throw "No se pudo leer el historial de migraciones de $Name." }
  return [int](($result | Out-String).Trim())
}

function Get-SchemaFingerprint {
  param([string]$Name)
  $query = "select md5(coalesce(string_agg(table_schema || '.' || table_name || ':' || ordinal_position || ':' || column_name || ':' || data_type || ':' || is_nullable, '|' order by table_schema, table_name, ordinal_position), '')) from information_schema.columns where table_schema = 'public' and table_name <> '_prisma_migrations'"
  $result = & $psql -h localhost -p $Port -U $DatabaseUser -d $Name -tAc $query
  if ($LASTEXITCODE -ne 0) { throw "No se pudo calcular la huella de esquema de $Name." }
  return ($result | Out-String).Trim()
}

function Get-TableDataEvidence {
  param([string]$Name)
  $tables = & $psql -h localhost -p $Port -U $DatabaseUser -d $Name -tAc "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> '_prisma_migrations' order by table_name"
  if ($LASTEXITCODE -ne 0) { throw "No se pudieron leer las tablas de $Name." }

  $pairs = @()
  $total = 0
  foreach ($table in $tables) {
    $tableName = ($table | Out-String).Trim()
    if (-not $tableName) { continue }
    $quoted = '"' + $tableName.Replace('"', '""') + '"'
    $count = & $psql -h localhost -p $Port -U $DatabaseUser -d $Name -tAc "select count(*) from public.$quoted"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo contar $tableName en $Name." }
    $countValue = [int64](($count | Out-String).Trim())
    $total += $countValue
    $pairs += "$tableName=$countValue"
  }

  $canonical = ($pairs | Sort-Object) -join '|'
  $bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
  $digest = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
  return [pscustomobject]@{
    fingerprint = ([BitConverter]::ToString($digest)).Replace('-', '').ToLowerInvariant()
    totalRows = $total
  }
}

try {
  New-Database $zeroDatabase ''
  New-Database $previousDatabase $BaseDatabase

  $env:DATABASE_URL = "postgresql://${DatabaseUser}@localhost:${Port}/${zeroDatabase}?schema=public"
  Invoke-Checked $prisma @('migrate', 'deploy', '--schema', 'src/backend/prisma/schema.prisma')
  $zeroCount = Get-MigrationCount $zeroDatabase

  $env:DATABASE_URL = "postgresql://${DatabaseUser}@localhost:${Port}/${previousDatabase}?schema=public"
  Invoke-Checked $prisma @('migrate', 'deploy', '--schema', 'src/backend/prisma/schema.prisma')
  $previousCount = Get-MigrationCount $previousDatabase

  $env:DATABASE_URL = "postgresql://${DatabaseUser}@localhost:${Port}/${BaseDatabase}?schema=public"
  $baseCount = Get-MigrationCount $BaseDatabase

  $zeroSchema = Get-SchemaFingerprint $zeroDatabase
  $previousSchema = Get-SchemaFingerprint $previousDatabase
  $baseSchema = Get-SchemaFingerprint $BaseDatabase
  $previousData = Get-TableDataEvidence $previousDatabase
  $baseData = Get-TableDataEvidence $BaseDatabase
  $schemaMatches = $zeroSchema -eq $previousSchema -and $previousSchema -eq $baseSchema
  $dataMatches = $previousData.fingerprint -eq $baseData.fingerprint

  if (-not $schemaMatches -or -not $dataMatches) {
    throw "La verificacion de huellas fallo: schemaMatches=$schemaMatches dataMatches=$dataMatches"
  }

  [pscustomobject]@{
    p12MigrationVerification = [pscustomobject]@{
      zeroDatabase = $zeroDatabase
      previousDatabase = $previousDatabase
      baseDatabase = $BaseDatabase
      previousSourceCommit = $PreviousCommit
      currentHead = $currentCommit
      zeroApplied = $zeroCount
      previousApplied = $previousCount
      baseApplied = $baseCount
      countsMatch = ($zeroCount -eq $previousCount -and $previousCount -eq $baseCount)
      schemaFingerprintsMatch = $schemaMatches
      previousDataFingerprintMatchesBase = $dataMatches
      zeroSchemaFingerprint = $zeroSchema
      previousSchemaFingerprint = $previousSchema
      baseSchemaFingerprint = $baseSchema
      previousDataFingerprint = $previousData.fingerprint
      baseDataFingerprint = $baseData.fingerprint
      previousRows = $previousData.totalRows
      baseRows = $baseData.totalRows
      status = 'PASS'
    }
  } | ConvertTo-Json -Depth 4
} finally {
  $env:DATABASE_URL = $null
  foreach ($name in $databaseNames) {
    if ($name -match '^sgmv_p12_(zero|previous)_[A-Za-z0-9]+$') {
      & $dropdb -h localhost -p $Port -U $DatabaseUser --if-exists $name | Out-Null
    }
  }
}
