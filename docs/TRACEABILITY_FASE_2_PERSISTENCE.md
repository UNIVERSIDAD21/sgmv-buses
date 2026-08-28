# Trazabilidad Fase 2 a Persistencia

**Fecha:** 2026-08-26
**Alcance:** alineación documental entre actores, RF oficiales, clases del diagrama y tablas técnicas de soporte.

Este documento no crea RF, actores, módulos ni procesos de negocio. Solo muestra qué clases principales y tablas técnicas soportan cada participación aprobada.

---

## RF oficiales

1. RF-01 — Gestión de la flota vehicular.
2. RF-02 — Control de novedades operativas.
3. RF-03 — Administración del mantenimiento preventivo.
4. RF-04 — Seguimiento de órdenes de trabajo.
5. RF-05 — Central de Repuestos.
6. RF-06 — Consulta de historial y generación de informes.

Autenticación, autorización, cierre de sesión, gestión mínima de cuentas y protección de rutas son transversales.

---

## Matriz actor/RF/clases/tablas técnicas

| Actor | RF | Participación aprobada | Clases relacionadas | Tablas técnicas de soporte |
|---|---|---|---|---|
| Administrador | RF-01 — Gestión de la flota vehicular | Registra, consulta y actualiza buses; gestiona asignación conductor-bus. | Usuario, Rol, Bus, AsignacionConductor | LecturaKilometraje; BusEstadoHistorial si se audita estado del bus |
| Administrador | RF-02 — Control de novedades operativas | Revisa, clasifica, resuelve/descarta o convierte novedades en orden. | Usuario, Rol, Bus, Novedad, OrdenTrabajo | OrdenEstadoHistorial cuando la conversión crea/cambia estado de orden |
| Administrador | RF-03 — Administración del mantenimiento preventivo | Crea y gestiona programaciones; genera órdenes preventivas sin duplicar activas. | Usuario, Rol, Bus, ProgramacionMantenimiento, OrdenTrabajo | LecturaKilometraje; OrdenEstadoHistorial |
| Administrador | RF-04 — Seguimiento de órdenes de trabajo | Crea/asigna/supervisa, reasigna tecnico, valida y cierra ordenes. | Usuario, Rol, Bus, Novedad, ProgramacionMantenimiento, OrdenTrabajo, Intervencion, ActividadOrden, ConsumoRepuesto, Repuesto, MovimientoInventario | OrdenEstadoHistorial; OrdenReasignacion |
| Administrador | RF-05 — Central de Repuestos | Administra catálogo, existencias, entradas, ajustes y movimientos. | Usuario, Rol, Repuesto, MovimientoInventario, ConsumoRepuesto, OrdenTrabajo | Ninguna adicional obligatoria; MovimientoInventario conserva responsable y fecha |
| Administrador | RF-06 — Consulta de historial y generación de informes | Consulta historial completo permitido, costos básicos trazables e informes filtrables. | Bus, AsignacionConductor, Novedad, ProgramacionMantenimiento, OrdenTrabajo, Intervencion, ActividadOrden, Repuesto, ConsumoRepuesto, MovimientoInventario, Informe como servicio | LecturaKilometraje; OrdenEstadoHistorial; OrdenReasignacion; BusEstadoHistorial si existe |
| Mecánico | RF-04 — Seguimiento de órdenes de trabajo | Consulta ordenes asignadas, antecedentes tecnicos, registra diagnostico, actividades, observaciones, consumos y marca completado tecnico. | Usuario, Rol, Bus, OrdenTrabajo, Intervencion, ActividadOrden, ConsumoRepuesto, Repuesto, MovimientoInventario | OrdenEstadoHistorial |
| Mecánico | RF-05 — Central de Repuestos | Consulta existencias y registra consumos autorizados asociados a orden. | Usuario, Rol, OrdenTrabajo, ConsumoRepuesto, Repuesto, MovimientoInventario | Ninguna adicional obligatoria; el consumo genera MovimientoInventario |
| Mecánico | RF-06 — Consulta de historial y generación de informes | Consulta historial técnico necesario para ejecutar su trabajo. | Bus, OrdenTrabajo, Intervencion, ActividadOrden, ConsumoRepuesto, Repuesto, Informe como servicio | OrdenEstadoHistorial; OrdenReasignacion cuando aporte contexto |
| Conductor | RF-01 — Gestión de la flota vehicular | Consulta únicamente su bus asignado. | Usuario, Rol, Bus, AsignacionConductor, ProgramacionMantenimiento | LecturaKilometraje cuando aporte próximo mantenimiento permitido |
| Conductor | RF-02 — Control de novedades operativas | Registra y consulta sus novedades. | Usuario, Rol, Bus, AsignacionConductor, Novedad, OrdenTrabajo solo como seguimiento permitido de su novedad | Ninguna adicional obligatoria |
| Conductor | RF-06 — Consulta de historial y generación de informes | Consulta solo resumen autorizado de su bus. | Bus, AsignacionConductor, Novedad, OrdenTrabajo, ProgramacionMantenimiento, Informe como servicio | LecturaKilometraje cuando aporte contexto autorizado |

---

## Reglas de lectura para la matriz

- `Informe` se interpreta como servicio/consulta/DTO/vista; no como tabla inicial.
- `ProgramacionMantenimiento` puede tener muchas órdenes preventivas históricas, pero máximo una activa.
- La relación de repuestos es `OrdenTrabajo → ConsumoRepuesto → Repuesto`.
- `MovimientoInventario` no crea una relación directa OrdenTrabajo-MovimientoInventario; en consumos se llega a la orden por ConsumoRepuesto.
- Las tablas técnicas se justifican por trazabilidad y no agregan RF ni roles.

---

## Matriz RF -> clases -> tablas fisicas

| RF oficial | Clases del diagrama | Tablas fisicas implementadas | Soporte tecnico/auditoria |
|---|---|---|---|
| RF-01 — Gestión de la flota vehicular | `Bus`, `AsignacionConductor`, `Usuario`, `Rol` | `buses`, `asignaciones_conductor`, `usuarios`, `roles` | `lecturas_kilometraje`, `bus_estado_historial` |
| RF-02 — Control de novedades operativas | `Novedad`, `Usuario`, `Bus`, `OrdenTrabajo` | `novedades`, `usuarios`, `buses`, `ordenes_trabajo` | `orden_estado_historial` |
| RF-03 — Administración del mantenimiento preventivo | `ProgramacionMantenimiento`, `OrdenTrabajo`, `Bus` | `programaciones_mantenimiento`, `ordenes_trabajo`, `buses` | `lecturas_kilometraje`, `orden_estado_historial` |
| RF-04 — Seguimiento de órdenes de trabajo | `OrdenTrabajo`, `Intervencion`, `ActividadOrden`, `ConsumoRepuesto`, `Repuesto`, `MovimientoInventario`, `Usuario` | `ordenes_trabajo`, `intervenciones`, `actividades_orden`, `consumos_repuesto`, `repuestos`, `movimientos_inventario`, `usuarios` | `orden_estado_historial`, `orden_reasignaciones`, `clave_idempotencia` de consumo |
| RF-05 — Central de Repuestos | `Repuesto`, `ConsumoRepuesto`, `MovimientoInventario`, `OrdenTrabajo`, `Usuario` | `repuestos`, `consumos_repuesto`, `movimientos_inventario`, `ordenes_trabajo`, `usuarios` | Reglas transaccionales de consumo y stock en servicios |
| RF-06 — Consulta de historial y generación de informes | `Informe` como servicio y clases consultadas | No existe tabla `Informe`; consulta tablas de flota, novedades, preventivos, ordenes, actividades, consumos, repuestos y movimientos | Vistas/DTO/servicios futuros sin modificar datos historicos |

Ver tambien `docs/DATABASE_STRUCTURE.md` y `docs/DATA_DICTIONARY.md` para el detalle fisico de claves, indices y restricciones.

---

## Implementacion RF-01 cerrada

**Fecha:** 2026-08-27

| RF | API/servicio implementado | Frontend implementado | Pruebas |
|---|---|---|---|
| RF-01 - Gestion de la flota vehicular | `GET/POST/PATCH /flota/buses`, `/flota/resumen`, `/flota/mi-bus`, historiales de kilometraje/estado/asignacion y conductores disponibles | Listado, filtros, paginacion, formulario, detalle, acciones sensibles, panel administrador y panel conductor | Backend `fleet.test.ts`; frontend `App.test.tsx`; capturas `docs/screenshots/rf01-*` |

RF-02, RF-03, RF-04, RF-05 y RF-06 no fueron iniciados en este bloque.

---

## Implementacion RF-02 cerrada

**Fecha:** 2026-08-27

| RF | API/servicio implementado | Frontend implementado | Pruebas |
|---|---|---|---|
| RF-02 - Control de novedades operativas | `POST /novedades`, `/novedades/mis-novedades`, `/novedades/resumen`, `GET /novedades`, `GET /novedades/:id`, revision controlada y conversion a orden correctiva | Formulario y listado del conductor, detalle autorizado, panel administrativo, filtros, revision, conversion y resumen de orden generada | Backend `novelty.test.ts`; frontend `App.test.tsx`; capturas `docs/screenshots/rf02-*` |

RF-03 fue implementado en el bloque siguiente. RF-04 solo recibe ordenes originadas por novedad como dato inicial, sin implementar asignacion tecnica ni ejecucion.

---

## Implementacion RF-03 cerrada

**Fecha:** 2026-08-27

| RF | API/servicio implementado | Frontend implementado | Pruebas |
|---|---|---|---|
| RF-03 - Administracion del mantenimiento preventivo | `GET /mantenimiento-preventivo/resumen`, `GET/POST /mantenimiento-preventivo/programaciones`, `GET/PATCH /mantenimiento-preventivo/programaciones/:programacionId`, `POST /mantenimiento-preventivo/programaciones/:programacionId/generar-orden`, clasificacion centralizada y transaccion de orden preventiva | Panel administrador, resumen, listado, filtros, paginacion, formularios por fecha/kilometraje/combinado, detalle, reprogramacion y confirmacion de generacion de orden | Backend `preventive.test.ts`; frontend `App.test.tsx`; capturas `docs/screenshots/rf03-*` |

RF-04 fue implementado en el bloque siguiente. RF-05 y RF-06 no fueron iniciados.

---

## Implementacion RF-04 cerrada

**Fecha:** 2026-08-28

| RF | API/servicio implementado | Frontend implementado | Pruebas |
|---|---|---|---|
| RF-04 - Seguimiento de ordenes de trabajo | `/ordenes-trabajo`, resumen, listados, detalle, historial, reasignaciones, asignacion, reasignacion, inicio, reanudacion, intervencion, actividades, repuestos disponibles, consumos, completado, devolucion y cierre | Vista administrador, vista mecanico, filtros, formularios, detalle, dialogos de asignacion/reasignacion/devolucion/cierre, paneles por rol y conductor denegado | Backend `work-order.test.ts`; frontend `App.test.tsx`; capturas `docs/screenshots/rf04-*` |

RF-05 y RF-06 no fueron iniciados. RF-04 usa repuestos solo para consumo transaccional durante una orden en ejecucion; no administra catalogo ni genera informes consolidados.
