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

**FASE 3 AUTORIZADA. BOOTSTRAP TECNICO Y BLOQUE DE PERSISTENCIA COMPLETADOS, AUDITADOS Y DOCUMENTADOS. AUTENTICACION Y RF COMPLETOS AUN NO IMPLEMENTADOS.**

Las decisiones tecnicas aprobadas con ajustes finales quedaron registradas en `DECISIONS.md` y consolidadas en la documentacion de soporte.

Resumen:

- Estados de novedades aprobados.
- Estados y transiciones de ordenes aprobados; `CERRADA` es terminal.
- Umbral preventivo aprobado: 7 dias y 500 km.
- Asignacion conductor-bus: maximo una asignacion activa por conductor y por bus.
- Bootstrap monorepo con `src/frontend`, `src/backend`, npm workspaces, React/Vite/Tailwind, Node/Express, Prisma/Zod, ESLint/Prettier y pruebas minimas.
- Prisma ORM, Zod, bcrypt, JWT en cookie `HttpOnly`, Vitest/Supertest/React Testing Library/Playwright, ESLint/Prettier.
- Despliegue definitivo: frontend en Vercel, API en Render y PostgreSQL en Neon.
- Alineación documental oficial con diagramas de Fase 2 recibidos el 2026-08-26.
- Diagramas oficiales guardados sin alterar en `docs/diagrams/`.
- `DATA_MODEL.md` y `PERSISTENCE_MODEL_PROPOSAL.md` alineados con la interpretación oficial de clases, actores, relaciones, RF y tablas técnicas permitidas.
- `schema.prisma`, migracion inicial PostgreSQL/Neon, migraciones correctivas de auditoria/search_path, seed minimo seguro y pruebas de integridad implementados.
- Entregables academicos de base de datos creados: `DATABASE_STRUCTURE.md`, `DATA_DICTIONARY.md`, diagrama relacional fisico editable `.drawio` y PNG.

### Estado de inicio

OpenClaw recibió la orden explícita `INICIAR FASE 3`.

El primer bloque permitido ya fue ejecutado: bootstrap técnico del repositorio.

La revisión documental de Persistencia fue autorizada, actualizada, implementada y auditada tras aprobación explícita del propietario. OpenClaw debe detenerse antes de implementar autenticacion, servicios, repositorios o RF completos hasta nueva autorización del propietario.

---

## Aspectos técnicos aprobados para Fase 3

Ya quedaron aprobados:

- libreria SQL/ORM: Prisma;
- validacion: Zod;
- auth: email/contrasena, bcrypt y JWT en cookie `HttpOnly`;
- testing: Vitest, Supertest, React Testing Library y Playwright;
- lint/format: ESLint y Prettier;
- proveedor final: Vercel para frontend, Render para API y Neon para PostgreSQL.

Las decisiones adoptadas estan registradas en `DECISIONS.md`.

---

## Aspectos que requieren especial cuidado

- Implementar exactamente la maquina de estados aprobada para ordenes.
- Aplicar el umbral aprobado de "mantenimiento proximo": 7 dias y 500 km.
- Aplicar restricciones aprobadas de asignacion conductor-bus.
- Aplicar la interpretación oficial de ProgramacionMantenimiento: muchas órdenes preventivas históricas con máximo una activa.
- Calcular `VIGENTE`, `PROXIMO` y `VENCIDO` sin persistirlos como estado durable que pueda quedar desactualizado.
- Mantener `Informe` como servicio/consulta/DTO/vista inicial, no como tabla.
- Mantener la relación de repuestos como `OrdenTrabajo -> ConsumoRepuesto -> Repuesto`.
- Configurar correctamente despliegue Vercel/Render/Neon, CORS, cookies y CSRF.

Si aparece una contradiccion con un artefacto posterior, detener, documentar impacto y consultar al propietario antes de implementar.

---

## Validacion del cierre de Persistencia

El cierre auditado de Persistencia quedo validado el 2026-08-26 con:

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
- Validacion desde cero en schema temporal de Neon, eliminado al finalizar.
- Auditoria SQL con cero inconsistencias en bus-orden, consumo-movimiento, subtotales, costos, motivos, fechas y normalizacion.

---

## Regla de versiones históricas

No volver a usar como línea de desarrollo:

- listas antiguas de 24 RF;
- matriz granular de 52 RF;
- la consolidación anterior donde "Gestión de usuarios" ocupaba RF-01.

La línea vigente es la de seis RF descrita en `REQUIREMENTS.md`.
