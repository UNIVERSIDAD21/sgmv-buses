# Estructura fisica de base de datos

**Fecha:** 2026-08-26  
**Bloque:** auditoria final de Persistencia y modelo de datos  
**Estado:** implementado, validado localmente con Prisma y pendiente de seguir sin autenticacion hasta aprobacion explicita.

Este documento describe la estructura fisica implementada en PostgreSQL/Neon desde `src/backend/prisma/schema.prisma` y las migraciones Prisma. El modelo respeta los diagramas oficiales de Fase 2 y la interpretacion textual aprobada en `DATA_MODEL.md`, `PERSISTENCE_MODEL_PROPOSAL.md`, `DECISIONS.md`, `BUSINESS_RULES.md` y `TRACEABILITY_FASE_2_PERSISTENCE.md`.

No existe tabla `Informe`. RF-06 se resuelve mediante consultas, DTO, servicios de reporte o vistas derivadas que no modifican datos historicos.

---

## 1. Migraciones aplicadas

| Migracion | Proposito | Tipo |
|---|---|---|
| `20260826140227_inicial_persistencia` | Crea enums, 16 tablas, PK, FK, indices principales, indices parciales y checks base. | Inicial |
| `20260826154500_auditoria_integridad_db` | Agrega endurecimiento no destructivo: coherencia bus-orden, coherencia consumo-movimiento, normalizacion, fechas cronologicas, costos derivados, motivo administrativo y orden cerrada terminal. | Correctiva/aditiva |
| `20260826163500_fija_search_path_triggers` | Reemplaza funciones de triggers fijando `search_path` al schema de migracion para validaciones multi-schema seguras. | Correctiva/aditiva |

La migracion inicial no fue modificada retroactivamente. Los ajustes fisicos posteriores quedaron en migraciones correctivas/aditivas separadas.

---

## 2. Tablas creadas

### Dominio principal

1. `roles`
2. `usuarios`
3. `buses`
4. `asignaciones_conductor`
5. `novedades`
6. `programaciones_mantenimiento`
7. `ordenes_trabajo`
8. `intervenciones`
9. `actividades_orden`
10. `repuestos`
11. `consumos_repuesto`
12. `movimientos_inventario`

### Tablas tecnicas de soporte

13. `lecturas_kilometraje`
14. `bus_estado_historial`
15. `orden_estado_historial`
16. `orden_reasignaciones`

Estas tablas tecnicas no crean RF adicionales. Conservan trazabilidad con responsable, fecha y relacion hacia clases principales.

---

## 3. Relaciones principales implementadas

| Relacion | Implementacion fisica |
|---|---|
| `Rol -> Usuario` | `usuarios.rol_id -> roles.id`; cada usuario tiene exactamente un rol. |
| `Usuario/Bus -> AsignacionConductor` | `asignaciones_conductor.conductor_id`, `bus_id`, `asignado_por_id`; indices parciales para una sola asignacion activa por conductor y por bus. |
| `Usuario/Bus -> Novedad` | `novedades.conductor_id -> usuarios.id`, `novedades.bus_id -> buses.id`. |
| `Novedad -> OrdenTrabajo` | `ordenes_trabajo.novedad_id` unico y opcional; `origen = NOVEDAD` exige novedad. |
| `Bus -> ProgramacionMantenimiento` | `programaciones_mantenimiento.bus_id -> buses.id`. |
| `ProgramacionMantenimiento -> OrdenTrabajo` | `ordenes_trabajo.programacion_mantenimiento_id`; indice parcial impide mas de una orden activa por programacion. |
| `Bus -> OrdenTrabajo` | `ordenes_trabajo.bus_id -> buses.id`. |
| `Usuario(Mecanico) -> OrdenTrabajo` | `ordenes_trabajo.tecnico_asignado_id -> usuarios.id`; desde `ASIGNADA` debe existir. |
| `OrdenTrabajo -> Intervencion -> ActividadOrden` | FKs en cascada logica restrictiva: intervenciones y actividades dependen de la orden. |
| `OrdenTrabajo -> ConsumoRepuesto -> Repuesto` | `consumos_repuesto.orden_trabajo_id` y `repuesto_id`; no existe relacion directa `OrdenTrabajo-Repuesto`. |
| `Repuesto -> MovimientoInventario` | `movimientos_inventario.repuesto_id -> repuestos.id`. |
| `Usuario -> MovimientoInventario` | `movimientos_inventario.responsable_id -> usuarios.id`. |
| `ConsumoRepuesto -> MovimientoInventario` | `movimientos_inventario.consumo_repuesto_id` unico; cada consumo debe tener exactamente un movimiento tipo `CONSUMO`. |

No se implemento relacion directa redundante entre `OrdenTrabajo` y `MovimientoInventario`. Cuando el movimiento es consumo, la orden se obtiene por `movimientos_inventario -> consumos_repuesto -> ordenes_trabajo`.

---

## 4. Reglas controladas por PostgreSQL

| Regla | Mecanismo fisico |
|---|---|
| Solo tres roles funcionales | Enum `rol_codigo` y seed controlado. |
| Identificadores primarios | UUID en todas las tablas principales y tecnicas. |
| Integridad referencial | FKs con `ON DELETE RESTRICT` y `ON UPDATE CASCADE`. |
| Una asignacion activa por conductor | Indice parcial `ux_asignacion_conductor_activa`. |
| Una asignacion activa por bus | Indice parcial `ux_asignacion_bus_activa`. |
| Asignacion activa/cerrada coherente | `ck_asignaciones_conductor_estado_fechas`. |
| Una orden por novedad | Unique `ordenes_trabajo.novedad_id`. |
| Orden desde novedad del mismo bus | FK compuesta `ordenes_trabajo(novedad_id,bus_id) -> novedades(id,bus_id)`. |
| Orden preventiva del mismo bus de la programacion | FK compuesta `ordenes_trabajo(programacion_mantenimiento_id,bus_id) -> programaciones_mantenimiento(id,bus_id)`. |
| Una orden preventiva activa por programacion | Indice parcial `ux_orden_preventiva_activa_por_programacion`. |
| Origen/tipo de orden coherente | `ck_ordenes_origen_coherente`. |
| Tecnico obligatorio desde `ASIGNADA` | `ck_ordenes_tecnico_segun_estado`. |
| Fechas cronologicas de orden | `ck_ordenes_fechas_cronologicas`. |
| `CERRADA` terminal | Trigger `trg_ordenes_trabajo_cerrada_terminal`. |
| Cierre con responsable y fecha | `ck_ordenes_cierre_responsable`. |
| Kilometrajes, cantidades, stocks y costos no negativos | Checks de valores no negativos/positivos. |
| Criterio preventivo coherente | `ck_programaciones_mantenimiento_criterio`. |
| Subtotal calculado | `ck_consumos_repuesto_subtotal_calculado`. |
| `costo_total` derivado | Triggers `trg_ordenes_trabajo_set_costo_total` y `trg_consumos_repuesto_recalcular_costo_total`. |
| Movimiento consumo con mismo repuesto del consumo | FK compuesta `movimientos_inventario(consumo_repuesto_id,repuesto_id) -> consumos_repuesto(id,repuesto_id)`. |
| Cada consumo genera exactamente un movimiento | Constraint triggers diferibles sobre `consumos_repuesto` y `movimientos_inventario`. |
| Entradas y ajustes con motivo | `ck_movimientos_inventario_motivo_administrativo`. |
| Email, placa y codigos normalizados | Checks de normalizacion e indices funcionales case-insensitive. |
| Sin duplicados por mayusculas/minusculas | Indices `ux_*_lower` y `ux_*_upper`. |

---

## 5. Reglas controladas por servicios backend

Estas reglas requieren contexto de sesion, rol, flujo o varias consultas. Quedan documentadas para el bloque posterior de servicios/autenticacion:

- Validar que solo `ADMIN_SUPERVISOR` gestione buses, programaciones, reasignaciones, entradas, ajustes y cierres.
- Validar que solo `MECANICO` marque ejecucion tecnica como `COMPLETADA_TECNICO`.
- Validar que el conductor solo registre novedades de su bus activo y consulte solo su resumen autorizado.
- Calcular estados preventivos `VIGENTE`, `PROXIMO` y `VENCIDO` con umbral de 7 dias y 500 km, sin persistirlos como verdad durable.
- Ejecutar la generacion de orden preventiva y la actualizacion del siguiente objetivo en una transaccion.
- Validar transiciones completas de la maquina de estados, incluyendo que no se cierre desde `ASIGNADA` ni `EN_EJECUCION`.
- Exigir al menos una `ActividadOrden` antes de `COMPLETADA_TECNICO`.
- Exigir diagnostico en ordenes correctivas.
- Ejecutar consumo, movimiento y descuento de stock en una transaccion atomica con guardia de stock suficiente.
- Normalizar correo, placa y codigos antes de persistir para entregar errores controlados al usuario.
- Controlar mensajes de error, permisos y no exposicion de secretos.

---

## 6. Matriz RF -> clases -> tablas

| RF oficial | Clases principales | Tablas fisicas | Tablas tecnicas de soporte |
|---|---|---|---|
| RF-01 — Gestión de la flota vehicular | `Bus`, `AsignacionConductor`, `Usuario` | `buses`, `asignaciones_conductor`, `usuarios`, `roles` | `lecturas_kilometraje`, `bus_estado_historial` |
| RF-02 — Control de novedades operativas | `Novedad`, `Usuario`, `Bus`, `OrdenTrabajo` | `novedades`, `usuarios`, `buses`, `ordenes_trabajo` | `orden_estado_historial` cuando se convierte a orden |
| RF-03 — Administración del mantenimiento preventivo | `ProgramacionMantenimiento`, `OrdenTrabajo`, `Bus` | `programaciones_mantenimiento`, `ordenes_trabajo`, `buses` | `lecturas_kilometraje`, `orden_estado_historial` |
| RF-04 — Seguimiento de órdenes de trabajo | `OrdenTrabajo`, `Intervencion`, `ActividadOrden`, `Usuario` | `ordenes_trabajo`, `intervenciones`, `actividades_orden`, `usuarios` | `orden_estado_historial`, `orden_reasignaciones` |
| RF-05 — Central de Repuestos | `Repuesto`, `ConsumoRepuesto`, `MovimientoInventario`, `OrdenTrabajo`, `Usuario` | `repuestos`, `consumos_repuesto`, `movimientos_inventario`, `ordenes_trabajo`, `usuarios` | `orden_estado_historial` si el consumo acompaña cambios de orden |
| RF-06 — Consulta de historial y generación de informes | `Informe` como servicio, mas clases consultadas | Consulta `buses`, `novedades`, `programaciones_mantenimiento`, `ordenes_trabajo`, `intervenciones`, `actividades_orden`, `consumos_repuesto`, `repuestos`, `movimientos_inventario` | `lecturas_kilometraje`, `bus_estado_historial`, `orden_estado_historial`, `orden_reasignaciones` |

---

## 7. Entregables relacionados

- Diccionario fisico: `docs/DATA_DICTIONARY.md`.
- Diagrama editable: `docs/diagrams/modelo-relacional-fisico.drawio`.
- Diagrama PNG: `docs/diagrams/modelo-relacional-fisico.png`.
- DDL versionado: migraciones en `src/backend/prisma/migrations/`.
- Trazabilidad de Fase 2 a persistencia: `docs/TRACEABILITY_FASE_2_PERSISTENCE.md`.

---

## 8. Diferencias tecnicas frente al diagrama conceptual

- Los tipos conceptuales `int`, `String` y `boolean` se implementan con UUID, enums, `Decimal`, `date` y `timestamptz` cuando aportan precision tecnica.
- `Informe` no es tabla; es consulta/servicio/DTO/vista derivada.
- Se agregan tablas tecnicas aprobadas para auditoria e historial, sin crear RF nuevos.
- Se agregan indices parciales, checks, FKs compuestas y triggers porque Prisma no expresa todas las reglas de integridad necesarias en el schema declarativo.
- Las funciones PL/pgSQL fijan `search_path` para evitar que el pooler de Neon reutilice sesiones con schema temporal.
- Los campos de normalizacion y seguridad de `Usuario` soportan autenticacion futura, pero no implementan autenticacion en este bloque.

---

## 9. Estado de validacion

Validaciones ejecutadas durante este bloque:

- `prisma validate`
- `prisma migrate deploy` sobre Neon actual
- `prisma generate`
- seed de desarrollo con `SEED_USER_PASSWORD` temporal de proceso
- pruebas automatizadas de integridad Prisma/PostgreSQL
- validacion desde cero en schema Neon desechable con migraciones, seed y pruebas; el schema temporal fue eliminado al terminar

La validacion completa final queda registrada en `PROJECT_STATUS.md` y `TESTING.md` al cerrar el bloque.
