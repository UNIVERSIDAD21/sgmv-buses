# Software de Gestión de Mantenimiento Vehicular

Prototipo web académico con datos simulados para integrar la trazabilidad operativa y técnica de una flota de buses:

`bus + conductor + jornada + kilometraje → novedad → orden → intervención → consumo compatible → inventario → alerta → historial`

No es una integración operacional real con una empresa de transporte.

## Estado técnico

- RF-01 a RF-06 implementados y aceptados técnicamente.
- RNF-02 a RNF-05 aceptados.
- RNF-01 aceptado: las credenciales expuestas fueron remediadas; la API administrativa de Render queda `NOT CONFIGURED / NOT REQUIRED` y Borlty no conserva una credencial de Render.
- SHA de aplicación auditada: `3a4b0134e8960c499c3d77317ba138acb5ba3137`.
- Rama: `realineacion/trazabilidad-operativa-tecnica`.
- 23 migraciones Prisma aplicadas, sin pendientes.
- GATE-DOC cerrado: la documentación académica principal no fue modificada.

Fuente final: [`docs/p14/CIERRE_TECNICO.md`](docs/p14/CIERRE_TECNICO.md).

## Producción

- Frontend: <https://v0-bus-fleet-management-neon.vercel.app>
- Backend: <https://sgmv-backend-qvq1.onrender.com>
- Health: <https://sgmv-backend-qvq1.onrender.com/health>
- Readiness: <https://sgmv-backend-qvq1.onrender.com/ready>
- Base: PostgreSQL 17 en Neon.

Topología: `Browser → Vercel → /api rewrite → Render → Neon`.

## Stack y roles

- React, Vite y Tailwind CSS.
- Node.js, Express, Zod, Prisma y PostgreSQL.
- Vitest, Supertest, React Testing Library y Playwright.
- Administrador: gestión completa y costos autorizados.
- Despachador: operación sin diagnósticos ni costos.
- Mecánico: ejecución técnica sin economía administrativa.
- Conductor: jornada, bus, kilometraje y novedades propias.

## Ejecución local

Requisitos: Node 24.x, npm 11.x y PostgreSQL local.

```powershell
npm ci
npm run db:local:init
npm run prisma:generate:local
npm run prisma:migrate:local
npm run prisma:seed:local
npm run dev:backend:local
npm run dev:frontend
```

Las contraseñas demo provienen de `SEED_USER_PASSWORD` en `.env.local`; no se documentan valores.

## Gate técnico

```powershell
npm run prisma:validate
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

Producción requiere `SGMV_PROD_TEST_PASSWORD` desde el almacén protegido:

```powershell
npm run test:e2e:production
npm run p14:evidence
```

## Documentación principal

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md): RF/RNF vigentes.
- [`docs/USE_CASES.md`](docs/USE_CASES.md): casos de uso.
- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md): invariantes.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): arquitectura.
- [`docs/TESTING.md`](docs/TESTING.md): pruebas.
- [`docs/p14/CIERRE_TECNICO.md`](docs/p14/CIERRE_TECNICO.md): aceptación.
- [`docs/p14/MATRIZ_MAESTRA.csv`](docs/p14/MATRIZ_MAESTRA.csv): trazabilidad criterio por criterio.
- [`docs/p14/DEMO_REPRODUCIBLE.md`](docs/p14/DEMO_REPRODUCIBLE.md): sustentación.
- [`docs/p14/INVENTARIO_FINAL.md`](docs/p14/INVENTARIO_FINAL.md): verificación y operación.

Los `.env`, tokens, cookies y cadenas de conexión permanecen fuera del repositorio.
