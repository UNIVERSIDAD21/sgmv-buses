# P14 — Inventario técnico final

## Estado y topología

| Elemento | Valor verificable |
| --- | --- |
| Repositorio | `https://github.com/UNIVERSIDAD21/sgmv-buses.git` |
| Rama | `realineacion/trazabilidad-operativa-tecnica` |
| SHA de aplicación auditada | `3a4b0134e8960c499c3d77317ba138acb5ba3137` |
| Frontend | <https://v0-bus-fleet-management-neon.vercel.app> |
| Backend | <https://sgmv-backend-qvq1.onrender.com> |
| Base | Neon `super-firefly-88354262`, PostgreSQL 17 |
| Flujo | Browser → Vercel → rewrite `/api/*` → Render → Neon |
| Migraciones | 23 aplicadas, 0 pendientes |
| Naturaleza | Prototipo web académico con datos simulados |

## Fuentes de verdad P14

- `docs/p14/CIERRE_TECNICO.md`: preflight, aceptación RF/RNF, seguridad, riesgos y veredicto.
- `docs/p14/MATRIZ_MAESTRA.csv`: criterio → caso → regla → datos → endpoint → rol → prueba → evidencia → resultado.
- `docs/p14/DEMO_REPRODUCIBLE.md`: recorrido completo y versión corta.
- `docs/p14/evidencias/manifest.json`: índice máquina-legible con SHA-256.
- `docs/p14/evidencias/manifest.csv`: índice tabular.
- `docs/p14/evidencias/*.png`: 16 capturas actuales.

## Código y configuración

- Frontend: `src/frontend/src`, React, Vite y Tailwind CSS.
- Backend: `src/backend/src`, Node.js, Express, Zod y módulos por dominio.
- Persistencia: `src/backend/prisma/schema.prisma` y `src/backend/prisma/migrations`.
- Vercel: `vercel.json`, `npm run build:vercel`, salida `dist`.
- Render: `render.yaml`, `npm run build:render`, health check `/ready`.
- Neon/Prisma: `DATABASE_URL` pooled en runtime y `DIRECT_URL` directa para migraciones, ambas protegidas.
- Capturador P14: `src/frontend/e2e/p14-evidence.spec.ts` y `src/frontend/playwright.p14.config.ts`.

## Comandos reproducibles

```powershell
npm ci
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run format:check
npm run test:backend:local
npm --workspace @sgmv/frontend test
npm run test:e2e:local
npm run build
npm run check:bundle
npm audit
npm run p12:audit
npm run p13:config
```

Producción, solo con `SGMV_PROD_TEST_PASSWORD` inyectada por el almacén protegido:

```powershell
npm run test:e2e:production
npm run p14:evidence
```

Medición RNF-03:

```powershell
npm exec --workspace @sgmv/backend -- dotenv -e ../../.env.local -v NODE_ENV=test -- vitest --run --fileParallelism=false test/p12-performance.test.ts --disableConsoleIntercept
```

Migraciones, sin imprimir cadenas de conexión:

```powershell
npm run prisma:migrate
npm --workspace @sgmv/backend exec -- prisma migrate status --schema prisma/schema.prisma
```

## Pruebas y evidencia

- Backend: 20 archivos, 175 pruebas.
- Frontend: 11 archivos, 74 pruebas.
- Playwright local: suites P5–P12.
- Producción: 4 roles, autenticación, sesión, cookies, CSRF, permisos, privacidad y logout.
- Evidencia visual: 390x844, 1024x768, 1440x900.
- Integridad visual: hashes SHA-256 del manifest.
- Dependencias: `npm audit` con cero vulnerabilidades.
- Licencias/secretos: `p12:audit` PASS, cero archivos de secretos.

## Runbook de salud y smoke

1. Consultar Vercel `/` y esperar HTTP 200.
2. Consultar Render `/health` y `/ready`; por Vercel usar `/api/health` y `/api/ready`.
3. Si Render Free estaba dormido, esperar readiness sin redeploy.
4. Ejecutar smoke 4/4 con credencial demo protegida.
5. Confirmar Administrador con costos y Mecánico/Despachador/Conductor sin campos económicos no autorizados.
6. Revisar despliegues por SHA y logs por request ID, sin copiar secretos ni cuerpos sensibles.

## Rollback y roll-forward

### Frontend Vercel

- Rollback: promover un deployment READY anterior cuyo SHA y configuración estén validados.
- Roll-forward preferido: corregir en Git, pasar gate, push y promover el nuevo deployment.

### Backend Render

- Rollback: redeploy del commit anterior compatible con el esquema vigente.
- Roll-forward preferido: commit correctivo focalizado y redeploy.
- Nunca usar rollback de código si espera una columna no existente o elimina compatibilidad con datos actuales.

### Neon/Prisma

- Las migraciones aplicadas no se editan ni se revierten destructivamente.
- Roll-forward mediante migración aditiva probada localmente.
- Antes de cambios futuros: backup lógico, `prisma migrate status`, plan de compatibilidad y smoke.
- P14 no añadió ni modificó migraciones.

## Credenciales y secretos

- No hay valores en Git, documentación, logs o capturas.
- Neon API key: rotada y acceso verificado.
- Credencial demo: rotada y acceso verificado.
- Vercel API key: pendiente de rotación manual segura.
- Render API key: pendiente de rotación manual segura.
- No rotar `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CSRF_SECRET` ni `RATE_LIMIT_SECRET` sin evidencia de exposición.

## Riesgos y limitaciones

- Bloqueo Gate: rotación y revocación de Vercel/Render.
- Cold start en Render Free.
- Datos simulados; no GPS, telemetría, recaudo, app nativa, mensajería externa, ERP ni integraciones gubernamentales.
- GATE-DOC cerrado: documentos académicos institucionales no forman parte de estos cambios.
