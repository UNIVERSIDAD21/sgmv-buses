# Project Status

**Última consolidación documental:** 2026-08-25

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

- RF-01 Flota.
- RF-02 Novedades.
- RF-03 Preventivo.
- RF-04 Órdenes/correctivo.
- RF-05 Repuestos.
- RF-06 Historial/informes.

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

**DOCUMENTACION PREPARADA Y DECISIONES TECNICAS APROBADAS.**

Las decisiones tecnicas aprobadas con ajustes finales quedaron registradas en `DECISIONS.md` y consolidadas en la documentacion de soporte.

Resumen:

- Estados de novedades aprobados.
- Estados y transiciones de ordenes aprobados; `CERRADA` es terminal.
- Umbral preventivo aprobado: 7 dias y 500 km.
- Asignacion conductor-bus: maximo una asignacion activa por conductor y por bus.
- Prisma ORM, Zod, bcrypt, JWT en cookie `HttpOnly`, Vitest/Supertest/React Testing Library/Playwright, ESLint/Prettier.
- Despliegue definitivo: frontend en Vercel, API en Render y PostgreSQL en Neon.

### Bloqueo de inicio

OpenClaw **NO debe programar el producto hasta recibir una orden explícita equivalente a `INICIAR FASE 3`.**

Antes de esa orden puede:

- leer;
- guardar memoria;
- revisar consistencia;
- reportar dudas;
- preparar plan.

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
- Configurar correctamente despliegue Vercel/Render/Neon, CORS, cookies y CSRF.

Si aparece una contradiccion con un artefacto posterior, detener, documentar impacto y consultar al propietario antes de implementar.

---

## Regla de versiones históricas

No volver a usar como línea de desarrollo:

- listas antiguas de 24 RF;
- matriz granular de 52 RF;
- la consolidación anterior donde "Gestión de usuarios" ocupaba RF-01.

La línea vigente es la de seis RF descrita en `REQUIREMENTS.md`.
