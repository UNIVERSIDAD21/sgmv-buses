# Decisions Log

Este archivo registra decisiones cerradas y evita que versiones históricas vuelvan a introducirse durante Fase 3.

---

## 2026-08-25 — OpenClaw solo trabaja en Fase 3

**Decisión:** OpenClaw se encarga exclusivamente de desarrollo, integración, pruebas/corrección y preparación técnica del prototipo.

**Motivo:** Fase 1 corresponde a análisis/requerimientos y Fase 2 a diseño.

**Impacto:** el agente implementa las decisiones anteriores; no las redefine unilateralmente.

**Estado:** APROBADA.

---

## 2026-08-25 — Se mantienen exactamente 6 RF principales

**Decisión:**

1. RF-01 Gestión de la flota vehicular.
2. RF-02 Control de novedades operativas.
3. RF-03 Administración del mantenimiento preventivo.
4. RF-04 Seguimiento de órdenes de trabajo.
5. RF-05 Central de Repuestos.
6. RF-06 Consulta de historial y generación de informes.

**Impacto:** no crear RF adicionales sin autorización.

**Estado:** APROBADA / LÍNEA BASE VIGENTE.

---

## 2026-08-25 — Renombrado oficial de RF sin cambio de alcance

**Decisión:** el propietario actualizó los nombres oficiales de los seis requerimientos funcionales de la línea base vigente:

1. RF-01 Gestión de la flota vehicular.
2. RF-02 Control de novedades operativas.
3. RF-03 Administración del mantenimiento preventivo.
4. RF-04 Seguimiento de órdenes de trabajo.
5. RF-05 Central de Repuestos.
6. RF-06 Consulta de historial y generación de informes.

**Impacto:** este cambio ajusta la denominación académica y de navegación de los módulos, pero no modifica cantidad de RF, RNF, flujos de casos de uso, reglas de negocio, alcance, arquitectura ni modelo de datos aprobados.

**Estado:** APROBADA / LÍNEA BASE VIGENTE.

---

## 2026-08-25 — Autenticación no es RF principal

**Decisión:** iniciar sesión, cerrar sesión, protección de rutas, autorización y gestión mínima de cuentas se implementan como capacidades transversales.

**Motivo:** son infraestructura funcional necesaria, pero no representan el proceso principal del dominio de mantenimiento.

**Impacto:** no usar "Gestión de usuarios" como uno de los seis RF principales.

**Estado:** APROBADA.

---

## 2026-08-25 — El Conductor/Operador tiene RF de negocio real

**Decisión:** el reporte y seguimiento de fallas/novedades se conserva como RF-02.

**Motivo:** el conductor constituye un punto de origen de información operativa que puede desencadenar mantenimiento correctivo.

**Impacto:** conductor no queda reducido a iniciar sesión/consultar datos.

**Estado:** APROBADA.

---

## 2026-08-25 — Flujo correctivo central

**Decisión:**

Conductor reporta → Supervisor revisa → resuelve/descarta o convierte a orden → asigna Mecánico → Mecánico ejecuta → Supervisor valida/cierra → historial se actualiza → Conductor ve seguimiento permitido.

**Estado:** APROBADA.

---

## 2026-08-25 — 4 RNF consolidados

**Decisión:** mantener:

- RNF-01 Seguridad.
- RNF-02 Usabilidad.
- RNF-03 Desempeño.
- RNF-04 Mantenibilidad.

**Estado:** APROBADA COMO BASE DE IMPLEMENTACIÓN.

---

## 2026-08-25 — Versiones de RF antiguas quedan reemplazadas

**Antecedentes conocidos:**

- se trabajó con una versión extensa de 24 RF + 10 RNF;
- existió una matriz aún más granular de 52 RF + 18 RNF;
- existió una consolidación de 6 RF donde RF-01 era "Gestión de usuarios".

**Decisión:** esas versiones sirven como antecedentes y detalle de análisis, pero no son la lista actual de RF para Fase 3.

**Estado:** REEMPLAZADAS.

---

## 2026-08-25 — Tres roles definitivos

- Administrador / Supervisor.
- Personal Técnico / Mecánico.
- Conductor / Operador.

**Estado:** APROBADA.

---

## 2026-08-25 — Mínimo privilegio del conductor

**Decisión:** solo su bus asignado, información básica permitida y sus novedades.

No costos, inventario administrativo, usuarios, otros buses ni gestión de órdenes.

**Estado:** APROBADA.

---

## 2026-08-25 — Stack principal

- React.
- Vite.
- Tailwind CSS.
- Node.js.
- Express.
- API REST.
- PostgreSQL en Neon.

**Estado:** APROBADA.

---

## 2026-08-25 — Arquitectura

**Decisión:** cliente-servidor, separación presentación / lógica de negocio / datos.

**Estado:** APROBADA.

---

## 2026-08-25 — Historial derivado

**Decisión:** el historial del bus se construye con datos validados de mantenimiento y no como un formulario independiente para escribir manualmente un historial paralelo.

**Estado:** APROBADA.

---

## 2026-08-25 — Alcance excluido

No GPS, telemetría, IoT, IA/ML, rutas, recaudo, pasajeros, ERP, contabilidad/nómina/facturación completa, app móvil nativa, mensajería automática externa, integraciones RUNT/AMB, multiempresa.

**Estado:** APROBADA.

---

# Decisiones técnicas aprobadas para Fase 3

## 2026-08-25 - Estados de novedades

**Decisión:** usar `estado_novedad` con:

- `PENDIENTE_REVISION`
- `RESUELTA_SIN_ORDEN`
- `DESCARTADA`
- `CONVERTIDA_A_ORDEN`

**Transiciones:** nueva novedad -> `PENDIENTE_REVISION`; desde `PENDIENTE_REVISION` puede pasar a `RESUELTA_SIN_ORDEN`, `DESCARTADA` o `CONVERTIDA_A_ORDEN`.

**Impacto:** la clasificación de la novedad se maneja separada del estado. Una novedad convertida conserva relación 0..1 con la orden y no puede generar duplicados.

**Estado:** APROBADA.

---

## 2026-08-25 - Estados de órdenes de trabajo

**Decisión:** usar `estado_orden_trabajo` con:

- `PENDIENTE_ASIGNACION`
- `ASIGNADA`
- `EN_EJECUCION`
- `COMPLETADA_TECNICO`
- `DEVUELTA_CORRECCION`
- `CERRADA`

**Transiciones:** nueva orden sin técnico -> `PENDIENTE_ASIGNACION`; nueva orden con técnico -> `ASIGNADA`; `PENDIENTE_ASIGNACION` -> `ASIGNADA`; `ASIGNADA` -> `EN_EJECUCION`; `EN_EJECUCION` -> `COMPLETADA_TECNICO`; `COMPLETADA_TECNICO` -> `CERRADA` o `DEVUELTA_CORRECCION`; `DEVUELTA_CORRECCION` -> `EN_EJECUCION`.

**Reglas:** `CERRADA` es terminal. No se cierra desde `ASIGNADA` ni `EN_EJECUCION`. La reasignación de mecánico es exclusiva del Administrador/Supervisor y queda auditada. Para `COMPLETADA_TECNICO` deben existir fechas de ejecución y actividades realizadas. En órdenes correctivas, diagnóstico obligatorio. Consumo de repuestos opcional. Cierre definitivo exclusivo del Administrador/Supervisor.

**Estado:** APROBADA.

---

## 2026-08-25 - Umbral y fórmula de mantenimiento próximo

**Decisión:** mantenimiento próximo por fecha si faltan 7 días calendario o menos; mantenimiento próximo por kilometraje si faltan 500 km o menos.

**Fórmula:** `VENCIDO` si cualquiera de los criterios aplicables está vencido. `PROXIMO` si ninguno está vencido y al menos un criterio aplicable está dentro del umbral. `VIGENTE` si no está vencido ni próximo.

**Reglas:** se admiten programaciones solo por fecha, solo por kilometraje o por ambos. No se puede generar más de una orden activa para la misma programación preventiva. Al cerrar una orden preventiva debe actualizarse la próxima fecha o el próximo kilometraje objetivo antes de permitir nueva generación.

**Estado:** APROBADA.

---

## 2026-08-25 - Asignación conductor-bus

**Decisión:** un conductor puede tener máximo un bus activo al mismo tiempo y un bus puede tener máximo un conductor activo al mismo tiempo.

**Reglas:** cada reasignación conserva historial cerrando la asignación anterior con `fechaFin` y `activa=false`. La reasignación se ejecuta en transacción. El backend determina el bus autorizado del conductor desde la asignación activa, no desde IDs enviados por el cliente.

**Estado:** APROBADA.

---

## 2026-08-25 - Persistencia y validación

**Decisión:** usar Prisma ORM para PostgreSQL/Neon y Zod para validación de datos.

**Impacto:** Prisma se usa para modelo, migraciones, cliente tipado, seed y transacciones. Zod se usa en backend como validación definitiva de entradas y puede reutilizarse en frontend para UX cuando convenga.

**Estado:** APROBADA.

---

## 2026-08-25 - Autenticación y autorización transversal

**Decisión:** usar email/contraseña, bcrypt para hash seguro y JWT en cookie `HttpOnly`.

**Reglas:** `Secure=true` en producción; `SameSite` según entorno; CORS restringido al dominio autorizado del frontend; protección CSRF o validación equivalente para operaciones de escritura; límite de intentos de login; expiración definida del JWT; prohibido registrar contraseñas, hashes o tokens en logs.

**Impacto:** auth, gestión mínima de cuentas, roles y permisos siguen siendo funcionalidad transversal y no crean RF adicional.

**Estado:** APROBADA.

---

## 2026-08-25 - Pruebas, lint y formato

**Decisión:** usar Vitest, Supertest, React Testing Library y Playwright. Usar ESLint y Prettier para lint/formato.

**Impacto:** pruebas unitarias, integración API/datos, interfaz y E2E críticos; formato consistente y mantenibilidad.

**Estado:** APROBADA.

---

## 2026-08-25 - Despliegue definitivo

**Decisión:** frontend React/Vite en Vercel, API Node.js/Express en Render y PostgreSQL en Neon.

**Motivo:** distribución coherente con presupuesto y documento académico. Reemplaza la propuesta previa de usar Render Static Site para el frontend.

**Impacto:** configurar `VITE_API_URL` en Vercel; `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, cookies/CSRF y demás variables en Render; CORS restringido al dominio real de Vercel.

**Estado:** APROBADA.

---

## 2026-08-25 - Bootstrap técnico del repositorio

**Decisión:** usar un monorepo con npm workspaces:

- `src/frontend` para React + Vite + Tailwind CSS.
- `src/backend` para Node.js + Express + API REST.

**Decisiones menores de implementación:**

- Usar TypeScript en frontend y backend.
- Usar un `package-lock.json` único en la raíz.
- Mantener scripts raíz para `dev:frontend`, `dev:backend`, `lint`, `test`, `build`, `format`, `prisma:validate` y `prisma:generate`.
- Fijar Prisma en `6.12.0` durante el bootstrap para mantener la sintaxis clásica de `schema.prisma` con `DATABASE_URL` y evitar vulnerabilidades reportadas por `npm audit` en la rama instalada inicialmente.
- Crear `schema.prisma` base sin modelos para no inventar ni modificar el modelo de datos aprobado antes del bloque de Persistencia.
- Usar una sola plantilla `.env.example` en la raíz, sin secretos reales.

**Impacto:** no modifica RF, RNF, casos de uso, reglas de negocio, alcance, arquitectura ni modelo de datos aprobado. Solo prepara la base técnica para iniciar la implementación por bloques.

**Estado:** APROBADA.
