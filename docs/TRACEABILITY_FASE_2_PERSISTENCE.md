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
| Administrador/Supervisor | RF-01 — Gestión de la flota vehicular | Registra, consulta y actualiza buses; gestiona asignación conductor-bus. | Usuario, Rol, Bus, AsignacionConductor | LecturaKilometraje; BusEstadoHistorial si se audita estado del bus |
| Administrador/Supervisor | RF-02 — Control de novedades operativas | Revisa, clasifica, resuelve/descarta o convierte novedades en orden. | Usuario, Rol, Bus, Novedad, OrdenTrabajo | OrdenEstadoHistorial cuando la conversión crea/cambia estado de orden |
| Administrador/Supervisor | RF-03 — Administración del mantenimiento preventivo | Crea y gestiona programaciones; genera órdenes preventivas sin duplicar activas. | Usuario, Rol, Bus, ProgramacionMantenimiento, OrdenTrabajo | LecturaKilometraje; OrdenEstadoHistorial |
| Administrador/Supervisor | RF-04 — Seguimiento de órdenes de trabajo | Crea/asigna/supervisa, reasigna técnico, valida y cierra órdenes. | Usuario, Rol, Bus, Novedad, ProgramacionMantenimiento, OrdenTrabajo, Intervencion, ActividadOrden | OrdenEstadoHistorial; OrdenReasignacion |
| Administrador/Supervisor | RF-05 — Central de Repuestos | Administra catálogo, existencias, entradas, ajustes y movimientos. | Usuario, Rol, Repuesto, MovimientoInventario, ConsumoRepuesto, OrdenTrabajo | Ninguna adicional obligatoria; MovimientoInventario conserva responsable y fecha |
| Administrador/Supervisor | RF-06 — Consulta de historial y generación de informes | Consulta historial completo permitido, costos básicos trazables e informes filtrables. | Bus, AsignacionConductor, Novedad, ProgramacionMantenimiento, OrdenTrabajo, Intervencion, ActividadOrden, Repuesto, ConsumoRepuesto, MovimientoInventario, Informe como servicio | LecturaKilometraje; OrdenEstadoHistorial; OrdenReasignacion; BusEstadoHistorial si existe |
| Personal Técnico/Mecánico | RF-04 — Seguimiento de órdenes de trabajo | Consulta órdenes asignadas, antecedentes técnicos, registra diagnóstico, actividades, observaciones, consumos y marca completado técnico. | Usuario, Rol, Bus, OrdenTrabajo, Intervencion, ActividadOrden, ConsumoRepuesto, Repuesto | OrdenEstadoHistorial |
| Personal Técnico/Mecánico | RF-05 — Central de Repuestos | Consulta existencias y registra consumos autorizados asociados a orden. | Usuario, Rol, OrdenTrabajo, ConsumoRepuesto, Repuesto, MovimientoInventario | Ninguna adicional obligatoria; el consumo genera MovimientoInventario |
| Personal Técnico/Mecánico | RF-06 — Consulta de historial y generación de informes | Consulta historial técnico necesario para ejecutar su trabajo. | Bus, OrdenTrabajo, Intervencion, ActividadOrden, ConsumoRepuesto, Repuesto, Informe como servicio | OrdenEstadoHistorial; OrdenReasignacion cuando aporte contexto |
| Conductor/Operador | RF-01 — Gestión de la flota vehicular | Consulta únicamente su bus asignado. | Usuario, Rol, Bus, AsignacionConductor, ProgramacionMantenimiento | LecturaKilometraje cuando aporte próximo mantenimiento permitido |
| Conductor/Operador | RF-02 — Control de novedades operativas | Registra y consulta sus novedades. | Usuario, Rol, Bus, AsignacionConductor, Novedad, OrdenTrabajo solo como seguimiento permitido de su novedad | Ninguna adicional obligatoria |
| Conductor/Operador | RF-06 — Consulta de historial y generación de informes | Consulta solo resumen autorizado de su bus. | Bus, AsignacionConductor, Novedad, OrdenTrabajo, ProgramacionMantenimiento, Informe como servicio | LecturaKilometraje cuando aporte contexto autorizado |

---

## Reglas de lectura para la matriz

- `Informe` se interpreta como servicio/consulta/DTO/vista; no como tabla inicial.
- `ProgramacionMantenimiento` puede tener muchas órdenes preventivas históricas, pero máximo una activa.
- La relación de repuestos es `OrdenTrabajo → ConsumoRepuesto → Repuesto`.
- `MovimientoInventario` no crea una relación directa OrdenTrabajo-MovimientoInventario; en consumos se llega a la orden por ConsumoRepuesto.
- Las tablas técnicas se justifican por trazabilidad y no agregan RF ni roles.
