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

1. RF-01 — Gestión de la flota vehicular.
2. RF-02 — Control de novedades operativas.
3. RF-03 — Administración del mantenimiento preventivo.
4. RF-04 — Seguimiento de órdenes de trabajo.
5. RF-05 — Central de Repuestos.
6. RF-06 — Consulta de historial y generación de informes.

**Impacto:** no crear RF adicionales sin autorización.

**Estado:** APROBADA / LÍNEA BASE VIGENTE.

---

## 2026-08-25 — Renombrado oficial de RF sin cambio de alcance

**Decisión:** el propietario actualizó los nombres oficiales de los seis requerimientos funcionales de la línea base vigente:

1. RF-01 — Gestión de la flota vehicular.
2. RF-02 — Control de novedades operativas.
3. RF-03 — Administración del mantenimiento preventivo.
4. RF-04 — Seguimiento de órdenes de trabajo.
5. RF-05 — Central de Repuestos.
6. RF-06 — Consulta de historial y generación de informes.

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
- Usar ESLint 10 durante el bootstrap para evitar iniciar con ESLint 9, que npm marcó como fuera de soporte.
- Crear `schema.prisma` base sin modelos para no inventar ni modificar el modelo de datos aprobado antes del bloque de Persistencia.
- Usar una sola plantilla `.env.example` en la raíz, sin secretos reales.

**Impacto:** no modifica RF, RNF, casos de uso, reglas de negocio, alcance, arquitectura ni modelo de datos aprobado. Solo prepara la base técnica para iniciar la implementación por bloques.

**Estado:** APROBADA.

---

## 2026-08-26 — Interpretación oficial de diagramas de Fase 2

**Decisión:** los diagramas oficiales de casos de uso y clases recibidos el 2026-08-26 son artefactos base de Fase 2 para orientar la implementación de Fase 3. Quedaron guardados sin alterar en:

- `docs/diagrams/diagrama-casos-uso-fase-2.png` (`SHA256: 83F6C2A0E8440D7E32FF3503FD2A90D8A7A0B587227F4023ECC3F0ADA2E20A00`)
- `docs/diagrams/diagrama-clases-fase-2.png` (`SHA256: D72849DD46451AAB5C82525750819DABF4ECF55AA4BCDFB47ADA2B77AB65FD85`)

Si una línea visual resulta ambigua por cruces, distribución o diferencias de rotulado, prevalece la interpretación textual oficial indicada por el propietario y esta documentación versionada.

**Casos de uso/RF oficiales:**

1. RF-01 — Gestión de la flota vehicular.
2. RF-02 — Control de novedades operativas.
3. RF-03 — Administración del mantenimiento preventivo.
4. RF-04 — Seguimiento de órdenes de trabajo.
5. RF-05 — Central de Repuestos.
6. RF-06 — Consulta de historial y generación de informes.

No crear RF adicionales. Autenticación, autorización, cierre de sesión, gestión mínima de cuentas y protección de rutas son capacidades transversales.

**Participación de actores:**

- Administrador/Supervisor participa en RF-01, RF-02, RF-03, RF-04, RF-05 y RF-06.
- Personal Técnico/Mecánico participa en RF-04, RF-05 con consulta de existencias y consumos autorizados, y RF-06 con historial técnico necesario.
- Conductor/Operador participa en RF-01 solo para consultar su bus asignado, RF-02 para registrar/consultar sus novedades y RF-06 mediante resumen autorizado de su bus.

**Clases principales del dominio:**

- Rol.
- Usuario.
- Bus.
- AsignacionConductor.
- Novedad.
- ProgramacionMantenimiento.
- OrdenTrabajo.
- Intervencion.
- ActividadOrden.
- Repuesto.
- ConsumoRepuesto.
- MovimientoInventario.
- Informe como servicio de consulta.

**Interpretaciones obligatorias para persistencia:**

- Cada Usuario tiene exactamente un Rol; solo existen los tres roles funcionales aprobados.
- Un conductor y un bus pueden tener muchas asignaciones históricas, pero máximo una asignación activa cada uno.
- La Novedad toma autor desde sesión y bus desde la asignación activa.
- Una Novedad puede generar cero o una OrdenTrabajo; si `origen = NOVEDAD`, la orden debe tener exactamente una Novedad y no duplicarla.
- ProgramacionMantenimiento puede generar cero o muchas órdenes preventivas históricas, con máximo una orden activa simultánea por programación.
- Al generar orden preventiva se conserva copia de la fecha y/o kilometraje objetivo que la originó.
- Los estados preventivos `VIGENTE`, `PROXIMO` y `VENCIDO` son calculados y no deben quedar desactualizados como columna persistida.
- OrdenTrabajo pertenece a Bus; puede estar inicialmente sin técnico y desde `ASIGNADA` debe tener exactamente un técnico.
- La asignación y reasignación de técnico corresponde al Administrador/Supervisor y queda auditada.
- Intervencion identifica al Mecánico responsable y contiene ActividadOrden.
- Para `COMPLETADA_TECNICO` debe existir al menos una actividad; en correctivas, diagnóstico obligatorio.
- La relación correcta de repuestos es `OrdenTrabajo → ConsumoRepuesto → Repuesto`.
- No implementar una relación directa OrdenTrabajo-Repuesto que ignore ConsumoRepuesto.
- MovimientoInventario pertenece a Repuesto e identifica Usuario responsable.
- Cada ConsumoRepuesto genera exactamente un MovimientoInventario de tipo consumo; entradas y ajustes no requieren ConsumoRepuesto.
- No interpretar "técnico asignado" de OrdenTrabajo y "responsable del movimiento" de MovimientoInventario como relación directa OrdenTrabajo-MovimientoInventario.
- Informe se implementa inicialmente como servicio, consulta, DTO o vista de reporte; no crear tabla `Informe`.

**Tablas técnicas permitidas:** `LecturaKilometraje`, `OrdenEstadoHistorial`, `OrdenReasignacion`, `BusEstadoHistorial` si se usa para auditar estado del bus, y otras estructuras estrictamente técnicas justificadas. No son nuevos módulos ni nuevos RF.

**Impacto:** `DATA_MODEL.md` y `PERSISTENCE_MODEL_PROPOSAL.md` quedan alineados con la interpretación oficial antes de iniciar implementación de Persistencia.

**Estado:** APROBADA / LÍNEA BASE VIGENTE PARA PERSISTENCIA.

---

## 2026-08-26 - Implementacion inicial de Persistencia

**Decision:** implementar el bloque de Persistencia aprobado con Prisma ORM sobre PostgreSQL/Neon.

**Implementado:**

- Modelos Prisma para las clases principales del diagrama, excepto `Informe`.
- Tablas tecnicas `LecturaKilometraje`, `BusEstadoHistorial`, `OrdenEstadoHistorial` y `OrdenReasignacion`.
- Enums para roles, estados, criterios, origen/tipo/prioridad de orden y movimientos de inventario.
- Migracion inicial `20260826140227_inicial_persistencia` aplicada en Neon.
- Indices unicos parciales y `CHECK` PostgreSQL para reglas que Prisma no expresa directamente.
- Seed minimo de desarrollo con usuarios demo y hash bcrypt, sin implementar autenticacion.
- Pruebas de integridad de relaciones y restricciones principales.

**Decisiones tecnicas complementarias:**

- Usar `dotenv-cli` para que los comandos Prisma del workspace backend lean `.env` desde la raiz del repositorio sin versionar secretos.
- Usar `bcryptjs` en el seed para generar hashes demo; esto no implementa login ni autorizacion.
- Incluir `BusEstadoHistorial` en la primera migracion para auditar cambios de estado del bus desde el inicio.

**No implementado en este bloque:**

- Tabla `Informe`.
- Relacion directa `OrdenTrabajo`-`Repuesto`.
- Relacion directa `OrdenTrabajo`-`MovimientoInventario`.
- Autenticacion, repositorios, servicios o RF completos.

**Estado:** APROBADA / IMPLEMENTADA COMO BLOQUE DE PERSISTENCIA.

---

## 2026-08-26 - Auditoria final de estructura de base de datos

**Decision:** antes de iniciar autenticacion, repositorios, servicios o RF completos, endurecer y documentar la estructura fisica de PostgreSQL/Prisma sin modificar retroactivamente la migracion inicial.

**Implementado en migracion correctiva aditiva:**

- Coherencia obligatoria entre bus de `OrdenTrabajo` y bus de `Novedad`.
- Coherencia obligatoria entre bus de `OrdenTrabajo` preventiva y bus de `ProgramacionMantenimiento`.
- Coherencia obligatoria entre repuesto de `MovimientoInventario` tipo `CONSUMO` y repuesto de `ConsumoRepuesto`.
- Regla diferible para que cada `ConsumoRepuesto` tenga exactamente un `MovimientoInventario` tipo `CONSUMO`.
- `subtotal` validado como `cantidad * costoUnitario`.
- `costoTotal` de la orden recalculado por PostgreSQL desde consumos reales.
- Fechas cronologicas de asignacion, inicio, completado tecnico y cierre.
- `CERRADA` como estado terminal a nivel de trigger.
- Motivo obligatorio para entradas y ajustes de inventario.
- Normalizacion de `email`, placas y codigos, con indices funcionales case-insensitive.
- Funciones PL/pgSQL de triggers con `search_path` fijado al schema de migracion para validar desde schemas desechables de Neon sin contaminar `public`.

**Seed:** se elimino la contraseña demo predeterminada en codigo. `SEED_USER_PASSWORD` es obligatoria y debe definirse solo en entorno local o variable de proceso.

**Documentacion academica creada:**

- `docs/DATABASE_STRUCTURE.md`.
- `docs/DATA_DICTIONARY.md`.
- `docs/diagrams/modelo-relacional-fisico.drawio`.
- `docs/diagrams/modelo-relacional-fisico.png`.

**No implementado en este bloque:**

- Autenticacion.
- Repositorios o servicios de negocio.
- Frontend visible.
- RF-01 a RF-06 completos.
- Tabla persistente `Informe`.
- Relaciones directas redundantes `OrdenTrabajo`-`Repuesto` u `OrdenTrabajo`-`MovimientoInventario`.

**Estado:** APROBADA / IMPLEMENTADA COMO CIERRE DE PERSISTENCIA.

---

## 2026-08-26 - Interfaz oficial y autenticacion por roles

**Decision:** integrar la interfaz seleccionada desde Figma Make como estructura visual oficial del SGMV e implementar autenticacion real como capacidad transversal, sin iniciar RF-01 a RF-06 completos.

**Base visual autorizada:**

- ZIP original: `C:\Users\ING-ERIK\Downloads\Create it.zip`.
- SHA-256: `F1A2FD90D27FA735A95E8E8C1BC4EE28F3D5C858C6D1717524C6F73B5F78759F`.
- La exportacion de Figma Make se usa como referencia visual y fuente selectiva de componentes.

**Implementado:**

- Frontend con React Router, rutas protegidas, recuperacion de sesion por `/auth/me` y cierre por `/auth/logout`.
- Cliente HTTP centralizado con `credentials: 'include'`.
- Estado de sesion centralizado y redireccion por autenticacion.
- Menus y paneles diferenciados por los tres roles oficiales.
- Pantalla de acceso denegado.
- Login real sin botones de acceso por rol, sin usuarios codificados, sin `localStorage` y sin exitos simulados.
- Shell visual con menu colapsable, tooltips accesibles, encabezado contextual, estados vacios/carga/error y fecha dinamica `es-CO`.
- Vista base de flota y formulario visual de buses sin CRUD RF-01 completo.
- Backend `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`.
- Repositorio, servicio, controlador, rutas, middleware de autenticacion y middleware de autorizacion por rol.
- Verificacion `bcrypt`, validacion Zod, rechazo de usuarios inactivos, errores seguros y bloqueo temporal por intentos fallidos.
- CORS con credenciales limitado a `CORS_ORIGIN`; escrituras de autenticacion con validacion de `Origin`.

**No copiado del ZIP:**

- Configuracion Figma Make, `.figma/`, agentes, planes, `package.json`, lockfile, Vite/TypeScript config, tipos conceptuales, mock data, fechas estaticas o dependencias vulnerables.

**Diferencias tecnicas necesarias frente al prototipo:**

- La navegacion ya no depende solo de `useState`; usa React Router.
- Los roles y permisos derivan del backend real y de `schema.prisma`.
- Los modulos RF pendientes muestran estados vacios honestos, no datos falsos.
- La sesion vive en cookie `HttpOnly`; no se almacena token en frontend.
- La autorizacion final queda en backend; ocultar opciones en UI no sustituye permisos de servidor.

**Documentacion creada:**

- `docs/AUTHENTICATION.md`.
- `docs/VISUAL_DESIGN.md`.

**Estado:** APROBADA / IMPLEMENTADA COMO FUNDACION VISUAL Y AUTENTICACION TRANSVERSAL.

---

## 2026-08-26 - Auditoria final de interfaz oficial y autenticacion

**Decision:** cerrar un bloque final de verificacion sobre la rama `feat/auth-ui-foundation`, corrigiendo solo defectos objetivos de la integracion visual y de autenticacion, sin iniciar RF-01 ni agregar funcionalidades de negocio.

**Ajustes permitidos y ejecutados:**

- Mejorar accesibilidad del boton de cierre de sesion en menu colapsado.
- Reforzar pruebas de sesion expirada, carga inicial y rutas inexistentes.
- Mantener los RF pendientes con estado literal "Modulo pendiente de implementacion".
- Regenerar capturas finales de auditoria en escritorio, portatil y movil.

**Evidencia:** `docs/AUTH_UI_FINAL_AUDIT.md` y capturas `docs/screenshots/audit-*.png`.

**Estado:** APROBADA / IMPLEMENTADA COMO AUDITORIA FINAL DE AUTENTICACION E INTERFAZ.

---

## 2026-08-27 - Implementacion RF-01 Gestion de la flota vehicular

**Decision:** implementar RF-01 como primer requerimiento funcional completo, conectado de frontend a PostgreSQL/Neon mediante API REST, servicios, repositorios y Prisma.

**Base de rama:** `main` remoto estaba limpio y actualizado, pero no contenia los commits auditados de autenticacion/interfaz. Para no trabajar sobre `main` y poder cumplir la precondicion tecnica de auth/ui, `feat/rf-01-flota` se creo desde `main` y luego avanzo con la base ya cerrada `feat/auth-ui-foundation`.

**Implementado:**

- Endpoints `/flota/*` protegidos por sesion y roles.
- DTOs de entrada/salida y validacion Zod estricta.
- Normalizacion de placa y codigo interno antes de persistir.
- Manejo controlado de duplicados con `409`.
- Registro de buses con historial inicial de estado.
- Edicion solo de campos permitidos.
- Registro transaccional de kilometraje con `LecturaKilometraje`.
- Cambio transaccional de estado con `BusEstadoHistorial`.
- Asignacion/reasignacion transaccional conductor-bus con cierre de historicos.
- Consulta limitada del bus asignado al conductor autenticado.
- Pantallas reales de listado, formulario, detalle, operaciones sensibles y paneles por rol.

**Decisiones de implementacion:**

- No crear endpoint de eliminacion fisica de bus; retirar se hace con estado `INACTIVO`.
- Exigir motivo para cambios de estado de bus.
- Mantener kilometraje y estado fuera del `PATCH /flota/buses/:busId`; se actualizan solo mediante endpoints trazados.
- El mecanico queda denegado en RF-01.

**No implementado:** RF-02, RF-03, RF-04, RF-05 y RF-06.

**Estado:** APROBADA / IMPLEMENTADA COMO RF-01.
