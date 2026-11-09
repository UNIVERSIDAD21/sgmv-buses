import fs from 'node:fs'
import { buildPlan, fingerprint, runId } from './plan.mjs'
import { connection, query, readSql, snapshot } from './pg.mjs'

const option = (k) => process.argv.find((x) => x.startsWith(k + '='))?.slice(k.length + 1)
const planFile = option('--plan')
if (!planFile) throw Error('Indique --plan=ruta.json')
const u = connection(),
  local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)
const applied =
  query(
    `SELECT count(*) FROM eventos_auditoria WHERE request_id='${runId}'::uuid AND accion='DEMO_CONTINUIDAD_COMPLETA';`,
  ) === '1'
if (applied) {
  console.log(JSON.stringify({ result: 'ALREADY_APPLIED', runId }))
  process.exit(0)
}
const before = snapshot()
if (!process.argv.includes('--apply')) {
  const plan = buildPlan(before, option('--cutoff') || new Date().toISOString())
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2))
  console.log(
    JSON.stringify({
      result: 'PREVIEW',
      runId,
      cutoff: plan.cutoff,
      summary: plan.summary,
      sourceFingerprint: plan.sourceFingerprint,
    }),
  )
} else {
  if (!process.argv.includes('--confirm-simulation')) throw Error('Falta --confirm-simulation')
  if (local && !u.pathname.startsWith('/sgmv_demo_rehearsal_'))
    throw Error('La copia local no está aislada')
  if (!local && (!u.hostname.endsWith('.neon.tech') || u.hostname !== option('--expected-host')))
    throw Error('Destino publicado no verificado')
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'))
  if (plan.runId !== runId || plan.sourceFingerprint !== fingerprint(before))
    throw Error('El inventario cambió desde la previsualización')
  if (Date.parse(plan.cutoff) > Date.now()) throw Error('No se ejecutan eventos futuros')
  const literal = JSON.stringify(plan).replaceAll("'", "''")
  const sql = readSql('./apply.sql')
    .replace('/*PLAN_JSON*/', () => `'${literal}'::jsonb`)
    .replace('/*VERIFY_QUERY*/', () => readSql('./verify.sql').trim().replace(/;$/, ''))
  fs.writeFileSync(planFile + '.sql', sql)
  const result = query(sql)
  const after = snapshot()
  if (JSON.stringify(before.protected) !== JSON.stringify(after.protected))
    throw Error('Cambió un hash de preservación; revisar inmediatamente el recibo y respaldo')
  const verification = JSON.parse(query(readSql('./verify.sql')))
  if (Object.entries(verification.checks).some(([, v]) => v !== 0))
    throw Error('Falló una comprobación de coherencia: ' + JSON.stringify(verification.checks))
  const receipt = {
    result: 'APPLIED',
    runId,
    cutoff: plan.cutoff,
    appliedAt: new Date().toISOString(),
    summary: plan.summary,
    preserved: after.protected,
    verification,
    databaseResult: result,
  }
  fs.writeFileSync(planFile + '.receipt.json', JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
}
