# Project Status

**Última consolidación documental:** 2026-08-26

## Fase académica

- Fase 1 — análisis/requerimientos: consolidada como insumo.
- Fase 2 — diseño: responsabilidad del proyecto/propietario, no de OpenClaw.
- Fase 3 — desarrollo: responsabilidad de OpenClaw cuando sea autorizada.

---

## Línea base vigente para desarrollo

### Roles: 3

- Administrador / Supervisor.
- Personal Técnico / Mecánico.
- Conductor / Operador.

### RF: 6

- RF-01 — Gestión de la flota vehicular.
- RF-02 — Control de novedades operativas.
- RF-03 — Administración del mantenimiento preventivo.
- RF-04 — Seguimiento de órdenes de trabajo.
- RF-05 — Central de Repuestos.
- RF-06 — Consulta de historial y generación de informes.

### RNF: 4

- Seguridad.
- Usabilidad.
- Desempeño.
- Mantenibilidad.

### Stack

- React.
- Vite.
- Tailwind.
- Node.js.
- Express.
- PostgreSQL/Neon.
- API REST.

---

## Estado de handoff

**FASE 3 AUTORIZADA. BOOTSTRAP TÉCNICO, PERSISTENCIA, AUDITORÍA DE BASE DE DATOS, INTERFAZ OFICIAL Y AUTENTICACIÓN TRANSVERSAL COMPLETADOS. RF-01 A RF-06 COMPLETOS AÚN NO IMPLEMENTADOS.**

Las decisiones técnicas aprobadas con ajustes finales quedaron registradas en `DECISIONS.md` y consolidadas en la documentación de soporte.

Resumen:

- Estados de novedades aprobados.
- Estados y transiciones de órdenes aprobados; `CERRADA` es terminal.
- Umbral preventivo aprobado: 7 días y 500 km.
- Asignación conductor-bus: máximo una asignación activa por conductor y por bus.
- Bootstrap monorepo con `src/frontend`, `src/backend`, npm workspaces, React/Vite/Tailwind, Node/Express, Prisma/Zod, ESLint/Prettier y pruebas mínimas.
- Prisma ORM, Zod, bcrypt, JWT en cookie `HttpOnly`, Vitest/Supertest/React Testing Library/Playwright, ESLint/Prettier.
- Despliegue definitivo: frontend en Vercel, API en Render y PostgreSQL en Neon.
- Alineación documental oficial con diagramas de Fase 2 recibidos el 2026-08-26.
- Diagramas oficiales guardados sin alterar en `docs/diagrams/`.
- `DATA_MODEL.md` y `PERSISTENCE_MODEL_PROPOSAL.md` alineados con la interpretación oficial de clases, actores, relaciones, RF y tablas técnicas permitidas.
- `schema.prisma`, migración inicial PostgreSQL/Neon, migraciones correctivas de auditoría/search_path, seed mínimo seguro y pruebas de integridad implementados.
- Entregables académicos de base de datos creados: `DATABASE_STRUCTURE.md`, `DATA_DICTIONARY.md`, diagrama relacional físico editable `.drawio` y PNG.
- Autenticación real implementada con email/contraseña, bcrypt, JWT en cookie `HttpOnly`, rutas `/auth/login`, `/auth/me` y `/auth/logout`.
- Interfaz visual seleccionada integrada como estructura oficial: login, menú lateral colapsable, encabezado contextual, paneles por rol, vista base de flota, formulario visual de buses y estados pendientes.

### Estado de inicio

OpenClaw recibió la orden explícita `INICIAR FASE 3`.

El primer bloque permitido ya fue ejecutado: bootstrap técnico del repositorio.

La revisión documental de Persistencia fue autorizada, actualizada, implementada y auditada tras aprobación explícita del propietario. La interfaz oficial y la autenticación transversal también fueron autorizadas e implementadas. OpenClaw debe detenerse antes de implementar RF-01 completo o cualquier RF operativo hasta nueva autorización del propietario.

---

## Aspectos técnicos aprobados para Fase 3

Ya quedaron aprobados:

- librería SQL/ORM: Prisma;
- validación: Zod;
- auth: email/contraseña, bcrypt y JWT en cookie `HttpOnly`;
- testing: Vitest, Supertest, React Testing Library y Playwright;
- lint/format: ESLint y Prettier;
- proveedor final: Vercel para frontend, Render para API y Neon para PostgreSQL.

Las decisiones adoptadas están registradas en `DECISIONS.md`.

---

## Aspectos que requieren especial cuidado

- Implementar exactamente la máquina de estados aprobada para órdenes.
- Aplicar el umbral aprobado de "mantenimiento próximo": 7 días y 500 km.
- Aplicar restricciones aprobadas de asignación conductor-bus.
- Aplicar la interpretación oficial de ProgramacionMantenimiento: muchas órdenes preventivas históricas con máximo una activa.
- Calcular `VIGENTE`, `PROXIMO` y `VENCIDO` sin persistirlos como estado durable que pueda quedar desactualizado.
- Mantener `Informe` como servicio/consulta/DTO/vista inicial, no como tabla.
- Mantener la relación de repuestos como `OrdenTrabajo -> ConsumoRepuesto -> Repuesto`.
- Configurar correctamente despliegue Vercel/Render/Neon, CORS, cookies y CSRF.
- Mantener la autenticación como capacidad transversal; no crear RF-07 ni gestión de usuarios como módulo principal.
- No mostrar datos simulados como si provinieran de Neon. Los RF pendientes deben mostrar estados vacíos o "Módulo pendiente de implementación".

Si aparece una contradicción con un artefacto posterior, detener, documentar impacto y consultar al propietario antes de implementar.

---

## Validación del cierre de Persistencia

El cierre auditado de Persistencia quedó validado el 2026-08-26 con:

- `prisma validate`.
- `prisma generate`.
- `prisma migrate status`.
- `prisma migrate deploy` sin migraciones pendientes.
- Seed de desarrollo con `SEED_USER_PASSWORD` temporal de proceso.
- Pruebas automatizadas: frontend 1/1, backend 9/9.
- `lint`.
- `format:check`.
- `build`.
- `npm audit --audit-level=moderate` sin vulnerabilidades.
- Validación desde cero en schema temporal de Neon, eliminado al finalizar.
- Auditoría SQL con cero inconsistencias en bus-orden, consumo-movimiento, subtotales, costos, motivos, fechas y normalización.

---

## Validación de interfaz oficial y autenticación

El bloque de interfaz oficial y autenticación transversal queda cubierto por:

- `POST /auth/login`.
- `GET /auth/me`.
- `POST /auth/logout`.
- Middleware `authenticate`.
- Middleware `authorizeRoles`.
- Validación Zod de credenciales.
- Verificación `bcrypt`.
- Bloqueo temporal por intentos fallidos.
- Rechazo de usuario inactivo.
- Cookie `HttpOnly` con expiración JWT.
- CORS con credenciales restringido a `CORS_ORIGIN`.
- Frontend con React Router, estado de sesión centralizado, rutas protegidas, acceso denegado y menús por rol.
- Documentación en `AUTHENTICATION.md` y `VISUAL_DESIGN.md`.

Validación ejecutada el 2026-08-26:

- `prisma validate`.
- `prisma generate`.
- `prisma migrate status` sin migraciones pendientes.
- Seed de desarrollo con `SEED_USER_PASSWORD` temporal de proceso.
- `typecheck`.
- `lint`.
- `format:check`.
- Pruebas frontend: 1 archivo, 7 pruebas.
- Pruebas backend: 3 archivos, 19 pruebas.
- `build`.
- `npm audit --audit-level=moderate` sin vulnerabilidades.
- `git diff --check`.
- Revisión de secretos temporales sin hallazgos versionables.
- Capturas en `docs/screenshots/`.

---

## Regla de versiones históricas

No volver a usar como línea de desarrollo:

- listas antiguas de 24 RF;
- matriz granular de 52 RF;
- la consolidación anterior donde "Gestión de usuarios" ocupaba RF-01.

La línea vigente es la de seis RF descrita en `REQUIREMENTS.md`.
