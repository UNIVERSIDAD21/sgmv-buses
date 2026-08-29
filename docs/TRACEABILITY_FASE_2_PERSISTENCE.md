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
| Mecánico | RF-05 — Central de Repuestos | No accede a la central administrativa; conserva consulta minima y consumo solo desde una orden RF-04 asignada y en ejecución. | Usuario, Rol, OrdenTrabajo, ConsumoRepuesto, Repuesto, MovimientoInventario | Ninguna adicional obligatoria; el consumo RF-04 genera MovimientoInventario |
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
| RF-05 — Central de Repuestos | `Repuesto`, `ConsumoRepuesto`, `MovimientoInventario`, `OrdenTrabajo`, `Usuario` | `repuestos`, `consumos_repuesto`, `movimientos_inventario`, `ordenes_trabajo`, `usuarios` | `movimientos_inventario.clave_idempotencia`, disponibilidad calculada y reglas transaccionales de stock |
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

RF-05 fue implementado en el bloque siguiente. RF-04 usa repuestos solo para consumo transaccional durante una orden en ejecucion; no administra catalogo ni genera informes consolidados. RF-06 no fue iniciado.

---

## Implementacion RF-05 cerrada

**Fecha:** 2026-08-29

| RF | API/servicio implementado | Frontend implementado | Pruebas |
|---|---|---|---|
| RF-05 - Central de repuestos | `/repuestos/resumen`, `GET/POST /repuestos`, detalle, edicion controlada, activar/desactivar, entradas, ajustes, movimientos por repuesto y `GET /inventario/movimientos` | Ruta `/repuestos`, navegacion de Administrador, resumen, catalogo, filtros, paginacion, formulario, detalle, entrada, ajuste, activacion/desactivacion y movimientos | Backend `spare-part.test.ts`; frontend `App.test.tsx`; capturas `docs/screenshots/rf05-*` |

RF-05 reutiliza `repuestos`, `movimientos_inventario`, `consumos_repuesto`, `ordenes_trabajo` y `usuarios`. La unica ampliacion fisica es `movimientos_inventario.clave_idempotencia`, nullable y con indice unico parcial, para distinguir doble envio del mismo comando frente a dos operaciones legitimas iguales. RF-06 no fue iniciado.

---

## Trazabilidad RF-05

| Escenario RF-05 | Caso de uso | Regla de negocio | Endpoint | Servicio/repositorio | Tablas/relaciones | Pantalla | Prueba backend | Prueba frontend | Evidencia visual |
|---|---|---|---|---|---|---|---|---|---|
| Alta con stock cero | CU-05 | Codigo unico, nombre obligatorio, stock no editable directo | `POST /repuestos` | `SparePartService.createSparePart`, `SparePartRepository.createSparePart` | `repuestos` | `/repuestos`, formulario `Nuevo repuesto` | `spare-part.test.ts` catalogo | `App.test.tsx` formulario RF-05 | `rf05-part-form-1440x900.png` |
| Alta con stock inicial | CU-05 | Stock inicial positivo exige movimiento e idempotencia | `POST /repuestos` | `createSparePart` transaccional | `repuestos`, `movimientos_inventario` | Formulario `Nuevo repuesto` | `spare-part.test.ts` stock inicial | `App.test.tsx` stock inicial | `rf05-part-form-1440x900.png` |
| Codigo duplicado | CU-05 alterno | Duplicado termina en conflicto controlado | `POST /repuestos` | normalizacion y manejo `P2002` | `repuestos.codigo` | Formulario `Nuevo repuesto` | `spare-part.test.ts` duplicado y carrera | `App.test.tsx` codigo duplicado | `rf05-part-form-1440x900.png` |
| Entrada | CU-05 | Cantidad positiva, repuesto activo, responsable, movimiento unico | `POST /repuestos/:repuestoId/entradas` | `registerEntry`, `applyStockOperation` | `repuestos`, `movimientos_inventario`, `usuarios` | Dialogo `Registrar entrada` | `spare-part.test.ts` entradas | `App.test.tsx` entrada | `rf05-stock-entry-1440x900.png` |
| Ajuste positivo | CU-05 | Direccion explicita, motivo obligatorio | `POST /repuestos/:repuestoId/ajustes` | `registerAdjustment`, `applyStockOperation` | `repuestos`, `movimientos_inventario` | Dialogo `Registrar ajuste` | `spare-part.test.ts` ajustes | `App.test.tsx` ajuste | `rf05-stock-adjustment-1440x900.png` |
| Ajuste negativo y stock insuficiente | CU-05 alterno | Disminucion nunca deja stock negativo | `POST /repuestos/:repuestoId/ajustes` | atomic decrement condicionado | `repuestos`, `movimientos_inventario` | Dialogo `Registrar ajuste` | `spare-part.test.ts` insuficiente/concurrencia | `App.test.tsx` stock insuficiente | `rf05-stock-adjustment-1440x900.png` |
| Bajo stock y agotado | CU-05 | Disponibilidad centralizada con minimo incluido en `BAJO` | `GET /repuestos/resumen`, `GET /repuestos` | `classifyAvailability`, list/summary | `repuestos` | Tarjetas y catalogo | `spare-part.test.ts` clasificacion | `App.test.tsx` resumen/catalogo | `rf05-low-stock-1024x768.png` |
| Desactivacion | CU-05 | Baja logica, conserva historia, impide nuevas operaciones | `POST /repuestos/:repuestoId/desactivar` | `setSparePartStatus` | `repuestos.estado` | Confirmacion de estado | `spare-part.test.ts` inactivo | `App.test.tsx` activar/desactivar | `rf05-part-detail-1440x900.png` |
| Consumo desde RF-04 | CU-05 integracion | Un consumo produce un movimiento `CONSUMO` y conserva costo historico | `POST /ordenes-trabajo/:ordenId/consumos`; consulta RF-05 por movimientos | `WorkOrderRepository.addConsumption`; `SparePartRepository.listMovements` | `ordenes_trabajo`, `consumos_repuesto`, `movimientos_inventario`, `repuestos` | Detalle e historial RF-05 | `spare-part.test.ts` integracion RF-04 | `App.test.tsx` movimiento enlazado | `rf05-rf04-consumption-movement-1440x900.png` |
| Acceso no autorizado | CU-05 alterno | Solo `ADMINISTRADOR` administra central | Todas las rutas `/repuestos` y `/inventario/movimientos` | `authenticate`, `authorizeRoles` | `usuarios`, `roles` | Guard de ruta y menu | `spare-part.test.ts` auth/roles | `App.test.tsx` guard/menu | `rf05-mobile-390x844.png` |
| Idempotencia y concurrencia | CU-05 alterno | Cero movimientos duplicados, cero stock negativo | `POST /repuestos`, entradas, ajustes y consumo RF-04 | transacciones, advisory lock, `clave_idempotencia` | `repuestos`, `movimientos_inventario`, `consumos_repuesto` | Bloqueo de doble envio | `spare-part.test.ts` carreras | `App.test.tsx` doble envio | `rf05-movements-1440x900.png` |
