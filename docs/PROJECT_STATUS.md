# Project Status

**Última consolidación documental:** 2026-08-28

## Fase académica

- Fase 1 — análisis/requerimientos: consolidada como insumo.
- Fase 2 — diseño: responsabilidad del proyecto/propietario, no de OpenClaw.
- Fase 3 — desarrollo: responsabilidad de OpenClaw cuando sea autorizada.

---

## Línea base vigente para desarrollo

### Roles: 3

- Administrador.
- Mecánico.
- Conductor.

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

**FASE 3 AUTORIZADA. BOOTSTRAP TÉCNICO, PERSISTENCIA, AUDITORÍA DE BASE DE DATOS, INTERFAZ OFICIAL, AUTENTICACIÓN TRANSVERSAL, RF-01 GESTIÓN DE LA FLOTA VEHICULAR, RF-02 CONTROL DE NOVEDADES OPERATIVAS, NORMALIZACIÓN TRANSVERSAL DE ROLES, RF-03 ADMINISTRACIÓN DEL MANTENIMIENTO PREVENTIVO Y RF-04 SEGUIMIENTO DE ÓRDENES DE TRABAJO COMPLETADOS. RF-05 Y RF-06 AÚN NO IMPLEMENTADOS.**

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
- Roles canónicos normalizados transversalmente a `ADMINISTRADOR`, `CONDUCTOR` y `MECANICO`; las etiquetas visibles son Administrador, Conductor y Mecánico.
- RF-04 implementado con endpoints reales en `/ordenes-trabajo`, maquina de estados centralizada, asignacion/reasignacion, intervenciones, actividades, consumos transaccionales, completado tecnico, devolucion y cierre administrativo.

### Estado de inicio

OpenClaw recibió la orden explícita `INICIAR FASE 3`.

El primer bloque permitido ya fue ejecutado: bootstrap técnico del repositorio.

La revisión documental de Persistencia fue autorizada, actualizada, implementada y auditada tras aprobación explícita del propietario. La interfaz oficial y la autenticación transversal también fueron autorizadas e implementadas. El propietario autorizo RF-01 el 2026-08-27 y quedo implementado end-to-end. El propietario autorizo RF-02 el 2026-08-27 y quedo implementado end-to-end. La normalización transversal de roles canónicos quedo completada después de RF-02 y antes de RF-03. El propietario autorizo RF-03 el 2026-08-27 y quedo implementado end-to-end. El propietario autorizo RF-04 el 2026-08-28 y quedo implementado end-to-end. OpenClaw debe detenerse antes de implementar RF-05 o RF-06 hasta nueva autorización del propietario.

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
- No mostrar datos simulados como si provinieran de Neon. RF-05 y RF-06 deben mostrar estados vacíos o "Módulo pendiente de implementación" mientras no existan endpoints reales.

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
- Pruebas frontend: 1 archivo, 10 pruebas.
- Pruebas backend: 3 archivos, 20 pruebas.
- `build`.
- `npm audit --audit-level=moderate` sin vulnerabilidades.
- `git diff --check`.
- Revisión de secretos temporales sin hallazgos versionables.
- Capturas en `docs/screenshots/`.

Auditoria final adicional:

- Documentada en `docs/AUTH_UI_FINAL_AUDIT.md`.
- Verifico login, credenciales invalidas, usuario inactivo, recuperacion/cierre/expiracion de sesion, acceso sin sesion, acceso por rol incorrecto, rutas inexistentes, menus por rol, drawer movil y ausencia de contrasenas/hashes en respuestas.
- Viewports auditados: `1440 x 900`, `1024 x 768` y `390 x 844`.
- Defectos corregidos: nombre accesible del boton de logout en menu colapsado, pruebas de sesion expirada/rutas inexistentes/carga inicial, estado literal de "Modulo pendiente de implementacion" y captura movil regenerada fuera de transicion.

---

## Validacion de RF-01

RF-01 queda cubierto por:

- Backend `src/backend/src/fleet/*`: schemas Zod, DTOs, repositorio, servicio, controlador y rutas.
- Frontend `src/frontend/src/features/flota/*`: cliente API, tipos, listado, formulario, detalle y operaciones sensibles.
- Panel administrador con indicadores reales desde `/flota/resumen`.
- Panel conductor con `/flota/mi-bus`.
- Documentacion dedicada en `docs/RF01_FLEET.md`.
- Evidencias visuales `docs/screenshots/rf01-*.png`.

Validacion ejecutada durante el bloque RF-01:

- Backend RF-01: permisos, duplicados, normalizacion, kilometraje, estado, asignaciones, bus asignado y rollback transaccional.
- Frontend RF-01: listado, busqueda, filtro, paginacion, formulario, validaciones, duplicados, detalle, kilometraje, estado, asignacion, conductor con/sin bus y mecanico denegado.
- Playwright visual en `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina y con foco alcanzable por teclado.

RF-02 fue implementado en el bloque siguiente. RF-03, RF-04, RF-05 y RF-06 no fueron iniciados durante RF-01.

---

## Validacion de RF-02

RF-02 queda cubierto por:

- Backend `src/backend/src/novelties/*`: schemas Zod, DTOs, repositorio, servicio, controlador y rutas.
- Frontend `src/frontend/src/features/novedades/*`: cliente API, tipos, formulario/listado conductor, detalle, panel administrativo, filtros, revision y conversion.
- Panel administrador con indicador real desde `/novedades/resumen`.
- Panel conductor con novedades propias desde `/novedades/mis-novedades` y acceso a registro.
- Documentacion dedicada en `docs/RF02_NOVEDADES.md`.
- Evidencias visuales `docs/screenshots/rf02-*.png`.

Validacion ejecutada durante el bloque RF-02:

- Backend RF-02: permisos, conductor con/sin asignacion, autor/bus derivados, suplantacion rechazada, consultas propias/admin, validaciones, transiciones, estados terminales, conversion a orden, historial inicial, duplicados/concurrencia y rollback transaccional.
- Frontend RF-02: formulario conductor, validaciones, doble envio, conductor sin bus, listado propio, detalle autorizado, listado administrativo, busqueda/filtros, revision, conversion a orden, estados vacio/error y mecanico denegado.
- Playwright visual en `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina y con foco alcanzable por teclado.

RF-03 fue implementado en el bloque siguiente. RF-04, RF-05 y RF-06 no fueron iniciados.

---

## Validacion de RF-03

RF-03 queda cubierto por:

- Backend `src/backend/src/preventive/*`: schemas Zod, DTOs, repositorio, servicio, controlador y rutas.
- Frontend `src/frontend/src/features/preventivo/*`: cliente API, tipos, resumen, listado, filtros, formulario, detalle, reprogramacion y generacion de orden preventiva.
- Panel administrador con indicador real desde `/mantenimiento-preventivo/resumen`.
- Documentacion dedicada en `docs/RF03_MANTENIMIENTO_PREVENTIVO.md`.
- Evidencias visuales `docs/screenshots/rf03-*.png`.

Alcance implementado:

- Programaciones por fecha, kilometraje o ambos.
- Clasificacion calculada en servidor como `VIGENTE`, `PROXIMO` o `VENCIDO`.
- Umbrales centralizados: `PREVENTIVE_SOON_DAYS=7` y `PREVENTIVE_SOON_KM=500`.
- Generacion explicita de orden preventiva solo para programaciones `PROXIMO` o `VENCIDO`.
- Orden preventiva creada con origen `PREVENTIVO`, tipo `PREVENTIVA`, estado `PENDIENTE_ASIGNACION`, mismo bus, sin mecanico asignado e historial inicial.
- Proteccion contra duplicados mediante transaccion Prisma e indice unico parcial de orden preventiva activa por programacion.
- Administrador como unico actor autorizado para RF-03; Conductor y Mecanico reciben acceso denegado.

Limites conservados:

- RF-03 no asigna mecanico, no inicia ejecucion, no registra diagnostico, no consume repuestos y no cierra ordenes.
- RF-04 cierra ordenes preventivas, pero no recalcula el siguiente objetivo porque el modelo fisico no contiene intervalos preventivos aprobados.

Validacion ejecutada durante el bloque RF-03:

- Backend RF-03: permisos, rechazo de alias heredados, creacion por fecha/kilometraje/combinada, filtros, paginacion, resumen, detalle, actualizacion controlada, recalculo por kilometraje oficial de RF-01, generacion de orden, idempotencia, concurrencia con solicitudes simultaneas, historial inicial y rollback transaccional.
- Frontend RF-03: ruta protegida, administrador autorizado, Conductor y Mecanico denegados, resumen real, listado, busqueda/filtros/paginacion, formularios por fecha/kilometraje/combinado, validaciones, doble envio, detalle, badges, reprogramacion, generacion de orden, estados vacio/error y controles por rol.
- Playwright visual en `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina, con dialogos accesibles y foco alcanzable por teclado.

RF-04 fue implementado en el bloque siguiente. RF-05 y RF-06 no fueron iniciados.

---

## Validacion de RF-04

RF-04 queda cubierto por:

- Backend `src/backend/src/work-orders/*`: schemas Zod, DTOs, maquina de estados, repositorio, servicio, controlador y rutas.
- Frontend `src/frontend/src/features/ordenes-trabajo/*`: cliente API, tipos, resumen, listados por rol, detalle, formularios de ejecucion y dialogos administrativos.
- Panel administrador con indicadores reales desde `/ordenes-trabajo/resumen`.
- Panel mecanico con indicadores reales desde `/ordenes-trabajo/resumen`.
- Documentacion dedicada en `docs/RF04_ORDENES_TRABAJO.md`.
- Evidencias visuales `docs/screenshots/rf04-*.png`.

Alcance implementado:

- Resumen, listado administrativo, mis ordenes de Mecanico, detalle, historial y reasignaciones.
- Creacion manual de orden correctiva directa con origen `CORRECTIVO_DIRECTO`.
- Recepcion de ordenes correctivas desde RF-02 y preventivas desde RF-03.
- Asignacion inicial y reasignacion con motivo, trazabilidad y perdida inmediata de permisos del Mecanico anterior.
- Inicio, reanudacion, diagnostico, observaciones, actividades y completado tecnico.
- Consulta minima de repuestos activos y consumo transaccional con movimiento `CONSUMO`, descuento de stock, costo del servidor e idempotencia.
- Devolucion para correccion y cierre administrativo.
- Orden `CERRADA` terminal.

Limites conservados:

- RF-04 no administra catalogo, compras, proveedores, entradas ni ajustes de inventario.
- RF-04 no genera informes consolidados ni exportaciones.
- La preventiva manual no se implementa por ausencia de origen fisico `MANUAL` e intervalos preventivos independientes.
- El cierre preventivo conserva objetivos copiados y no recalcula proxima fecha o kilometraje porque no existen campos fisicos de intervalo aprobados.

Validacion ejecutada durante el bloque RF-04:

- Backend RF-04 aislado: 11 pruebas aprobadas.
- Frontend RF-04 aislado: 5 pruebas aprobadas.
- Backend completo: 69 pruebas aprobadas.
- Frontend completo: 34 pruebas aprobadas.
- Typecheck y lint de frontend/backend correctos.
- Pruebas de concurrencia cubren asignacion incompatible, consumo con stock limitado, completado/cierre simultaneo y doble cierre.
- Neon temporal `rf04_final_20260828_1710`: migraciones desde cero, seed dos veces, RF-04 backend `11/11` y schema eliminado. Un primer intento tuvo `P1002` de advisory lock de Prisma y se repitio con lock deshabilitado sin migraciones simultaneas.

RF-05 y RF-06 no fueron iniciados.

---

## Regla de versiones históricas

No volver a usar como línea de desarrollo:

- listas antiguas de 24 RF;
- matriz granular de 52 RF;
- la consolidación anterior donde "Gestión de usuarios" ocupaba RF-01.

La línea vigente es la de seis RF descrita en `REQUIREMENTS.md`.
