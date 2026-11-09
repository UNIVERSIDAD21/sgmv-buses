import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

let maintenanceConnection
export function configureConnection(url) {
  maintenanceConnection = new URL(url)
}
export function connection() {
  const u = maintenanceConnection || new URL(process.env.DATABASE_URL || '')
  if (!['postgres:', 'postgresql:'].includes(u.protocol)) throw Error('Se requiere PostgreSQL')
  return u
}
export function query(sql) {
  const u = connection()
  const bin =
    process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '')
  const executable = bin
    ? path.join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql')
    : 'psql'
  const r = spawnSync(executable, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    input: "SET TIME ZONE 'UTC';\n" + sql,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: u.hostname,
      PGPORT: u.port || '5432',
      PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
      PGUSER: decodeURIComponent(u.username),
      PGPASSWORD: decodeURIComponent(u.password),
      PGSSLMODE: u.hostname.endsWith('.neon.tech') ? 'require' : 'disable',
      PGCLIENTENCODING: 'UTF8',
      PGCONNECT_TIMEOUT: '25',
    },
  })
  if (r.status !== 0)
    throw Error(
      `PostgreSQL: ${(r.stderr || r.error?.name || 'timeout').replace(/postgres(?:ql)?:\/\/\S+/g, '[CONEXION_REDACTADA]').slice(0, 2200)}`,
    )
  return r.stdout.trim()
}
export const readSql = (name) => fs.readFileSync(new URL(name, import.meta.url), 'utf8')
export const snapshot = () => JSON.parse(query(readSql('./snapshot.sql')))
