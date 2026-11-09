import crypto from 'node:crypto'

function token(user, secret, issuer, audience) {
  const now = Math.floor(Date.now() / 1000)
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const content =
    encode({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    encode({
      sub: String(user.id),
      email: user.email,
      rol: user.rol,
      iss: issuer,
      aud: audience,
      iat: now,
      nbf: 0,
      exp: now + 300,
      jti: crypto.randomUUID(),
    })
  return content + '.' + crypto.createHmac('sha256', secret).update(content).digest('base64url')
}
function financialKeys(value, path = '') {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value)
    .flatMap(([key, item]) => [
      /^(costo|subtotal|precio|valorInventario)/i.test(key) ? path + '.' + key : null,
      ...financialKeys(item, path + '.' + key),
    ])
    .filter(Boolean)
}
export async function smoke({
  base,
  secret,
  users,
  issuer = 'sgmv-api',
  audience = 'sgmv-web',
  cookie = 'sgmv_session',
}) {
  const checks = []
  async function get(user, route, expected = 200, privateFields = false) {
    const start = Date.now(),
      response = await fetch(base + route, {
        headers: { Cookie: cookie + '=' + token(user, secret, issuer, audience) },
        signal: AbortSignal.timeout(60000),
      })
    let body
    try {
      body = await response.json()
    } catch {
      body = null
    }
    const leaked = privateFields ? financialKeys(body) : []
    const row = {
      role: user.rol,
      route,
      status: response.status,
      expected,
      ms: Date.now() - start,
      leakedFields: leaked,
      pass: response.status === expected && leaked.length === 0,
    }
    checks.push(row)
    if (!row.pass) throw Error('Smoke falló: ' + JSON.stringify(row))
    return body
  }
  for (const user of users) {
    await get(user, '/auth/me')
    if (user.rol === 'ADMINISTRADOR') {
      await get(user, '/jornadas?busId=109')
      await get(user, '/mantenimiento-preventivo/resumen')
      await get(user, '/mantenimiento-preventivo/restricciones')
      await get(user, '/ordenes-trabajo?busId=109')
      await get(user, '/historial/buses/109')
      await get(user, '/repuestos')
    } else if (user.rol === 'DESPACHADOR') {
      await get(user, '/jornadas/atencion', 200, true)
      await get(user, '/ordenes-trabajo/despacho', 200, true)
      await get(user, '/mantenimiento-preventivo/restricciones', 200, true)
      await get(user, '/repuestos', 403)
    } else if (user.rol === 'MECANICO') {
      await get(user, '/ordenes-trabajo/mis-ordenes', 200, true)
      await get(user, '/historial/buses/109', 200, true)
      await get(user, '/repuestos', 403)
    } else {
      const current = await get(user, '/jornadas/mi-jornada', 200, true)
      const journey = current?.data?.jornadaActual
      if (!journey || journey.estado !== 'EN_CURSO')
        throw Error('El conductor de la demo no tiene jornada actual en curso')
      await get(user, '/novedades/mis-novedades', 200, true)
      await get(user, '/historial/mi-bus', 200, true)
      await get(user, '/repuestos', 403)
      await get(user, '/ordenes-trabajo', 403)
    }
  }
  const anonymous = await fetch(base + '/auth/me', { signal: AbortSignal.timeout(15000) })
  checks.push({
    role: 'ANONIMO',
    route: '/auth/me',
    status: anonymous.status,
    expected: 401,
    pass: anonymous.status === 401,
  })
  if (anonymous.status !== 401) throw Error('Sesión anónima no rechazada')
  return {
    authentication:
      'Sesiones firmadas efímeras de diagnóstico; no se modificaron credenciales ni se probó login por contraseña',
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
  }
}
