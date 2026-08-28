# Diccionario de datos fisico

**Fecha:** 2026-08-26
**Base:** `schema.prisma` y migraciones `20260826140227_inicial_persistencia` + `20260826154500_auditoria_integridad_db` + `20260826163500_fija_search_path_triggers` + `20260827123000_normaliza_roles_canonicos` + `20260827124500_normaliza_usuario_demo_admin`
**Motor:** PostgreSQL/Neon mediante Prisma ORM

Convenciones:

- `PK`: clave primaria.
- `FK`: clave foranea.
- `UQ`: valor unico.
- `IDX`: indice no unico.
- `CHECK`: restriccion de validacion PostgreSQL.
- Todas las FKs usan `ON DELETE RESTRICT` y `ON UPDATE CASCADE`, salvo que se indique otra cosa.
- `created_at` y `updated_at` son campos tecnicos de trazabilidad; `updated_at` lo mantiene Prisma con `@updatedAt`.

---

## 1. `roles`

Representa los tres roles funcionales oficiales.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `codigo` | `rol_codigo` | No | UQ | `ADMINISTRADOR`, `MECANICO`, `CONDUCTOR`. |
| `nombre` | `varchar(120)` | No |  | Nombre visible del rol. |
| `descripcion` | `text` | Si |  | Alcance funcional del rol. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `roles_pkey`.
- UQ `roles_codigo_key`.
- Dominio cerrado por enum `rol_codigo`.

---

## 2. `usuarios`

Representa cuentas minimas y actores funcionales.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `nombre` | `varchar(160)` | No |  | Nombre del usuario. |
| `email` | `varchar(180)` | No | UQ | Correo normalizado en minusculas. |
| `telefono` | `varchar(40)` | Si |  | Telefono opcional. |
| `contrasena_hash` | `varchar(255)` | No |  | Hash de contraseña; nunca texto plano. |
| `estado` | `estado_usuario` | No | `ACTIVO` | Estado funcional de la cuenta. |
| `rol_id` | `uuid` | No | FK -> `roles.id` | Rol exacto del usuario. |
| `intentos_fallidos_login` | `integer` | No | `0` | Soporte para seguridad transversal futura. |
| `bloqueado_hasta` | `timestamptz(6)` | Si |  | Bloqueo temporal por seguridad. |
| `ultimo_acceso_at` | `timestamptz(6)` | Si |  | Fecha de ultimo acceso. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `usuarios_pkey`.
- UQ `usuarios_email_key`.
- IDX `usuarios_rol_id_idx`, `usuarios_estado_idx`.
- FK `usuarios_rol_id_fkey`.
- CHECK `ck_usuarios_intentos_login_no_negativo`.
- CHECK `ck_usuarios_email_normalizado`: correo en minusculas, sin espacios externos y no vacio.
- UQ funcional `ux_usuarios_email_lower`: evita duplicados por mayusculas/minusculas.

---

## 3. `buses`

Base de RF-01, flota vehicular.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `codigo_interno` | `varchar(60)` | No | UQ | Codigo interno normalizado en mayusculas. |
| `placa` | `varchar(20)` | No | UQ | Placa normalizada en mayusculas. |
| `marca` | `varchar(100)` | No |  | Marca del bus. |
| `modelo` | `varchar(100)` | No |  | Modelo del bus. |
| `anio` | `integer` | No |  | Año del bus. |
| `kilometraje_actual` | `integer` | No | `0` | Ultimo kilometraje validado. |
| `estado_operativo` | `estado_bus` | No | `OPERATIVO` | Estado operacional. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `buses_pkey`.
- UQ `buses_codigo_interno_key`, `buses_placa_key`.
- IDX `buses_estado_operativo_idx`.
- CHECK `ck_buses_kilometraje_no_negativo`.
- CHECK `ck_buses_identificadores_normalizados`.
- UQ funcional `ux_buses_codigo_interno_upper`, `ux_buses_placa_upper`.

---

## 4. `lecturas_kilometraje`

Tabla tecnica para historial de kilometraje.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `bus_id` | `uuid` | No | FK -> `buses.id` | Bus al que pertenece la lectura. |
| `kilometraje_anterior` | `integer` | No |  | Valor anterior validado. |
| `kilometraje_nuevo` | `integer` | No |  | Valor nuevo validado. |
| `registrado_por_id` | `uuid` | No | FK -> `usuarios.id` | Usuario responsable del registro. |
| `fecha_registro` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha del registro. |
| `motivo` | `text` | Si |  | Motivo o soporte de la lectura. |

Indices y restricciones:

- PK `lecturas_kilometraje_pkey`.
- FK `lecturas_kilometraje_bus_id_fkey`.
- FK `lecturas_kilometraje_registrado_por_id_fkey`.
- IDX `lecturas_kilometraje_bus_id_fecha_registro_idx`.
- IDX `lecturas_kilometraje_registrado_por_id_idx`.
- CHECK `ck_lecturas_kilometraje_coherente`: valores no negativos y nuevo >= anterior.

---

## 5. `bus_estado_historial`

Tabla tecnica para auditoria de estado operativo del bus.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `bus_id` | `uuid` | No | FK -> `buses.id` | Bus auditado. |
| `estado_anterior` | `estado_bus` | Si |  | Estado previo. |
| `estado_nuevo` | `estado_bus` | No |  | Estado posterior. |
| `cambiado_por_id` | `uuid` | No | FK -> `usuarios.id` | Usuario responsable. |
| `fecha_cambio` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha del cambio. |
| `motivo` | `text` | Si |  | Justificacion. |

Indices y restricciones:

- PK `bus_estado_historial_pkey`.
- FK `bus_estado_historial_bus_id_fkey`.
- FK `bus_estado_historial_cambiado_por_id_fkey`.
- IDX `bus_estado_historial_bus_id_fecha_cambio_idx`.
- IDX `bus_estado_historial_cambiado_por_id_idx`.

---

## 6. `asignaciones_conductor`

Historial conductor-bus y base de permisos del conductor.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `conductor_id` | `uuid` | No | FK -> `usuarios.id` | Usuario conductor asignado. |
| `bus_id` | `uuid` | No | FK -> `buses.id` | Bus asignado. |
| `fecha_inicio` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Inicio de asignacion. |
| `fecha_fin` | `timestamptz(6)` | Si |  | Cierre historico. |
| `activa` | `boolean` | No | `true` | Indica asignacion vigente. |
| `asignado_por_id` | `uuid` | No | FK -> `usuarios.id` | Administrador responsable. |
| `motivo` | `text` | Si |  | Motivo de asignacion/reasignacion. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `asignaciones_conductor_pkey`.
- FK a `usuarios` por `conductor_id` y `asignado_por_id`.
- FK `asignaciones_conductor_bus_id_fkey`.
- IDX `asignaciones_conductor_bus_id_idx`, `conductor_id_idx`, `asignado_por_id_idx`.
- UQ parcial `ux_asignacion_conductor_activa`: una asignacion activa por conductor.
- UQ parcial `ux_asignacion_bus_activa`: una asignacion activa por bus.
- CHECK `ck_asignaciones_conductor_estado_fechas`.

---

## 7. `novedades`

RF-02, novedades operativas reportadas por conductor.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `conductor_id` | `uuid` | No | FK -> `usuarios.id` | Autor de la novedad. |
| `bus_id` | `uuid` | No | FK -> `buses.id` | Bus asociado. |
| `fecha_reporte` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha del reporte. |
| `tipo` | `varchar(120)` | No |  | Tipo textual de novedad. |
| `descripcion` | `text` | No |  | Descripcion reportada. |
| `clasificacion` | `varchar(120)` | Si |  | Clasificacion del administrador. |
| `estado` | `estado_novedad` | No | `PENDIENTE_REVISION` | Estado de revision. |
| `revisada_por_id` | `uuid` | Si | FK -> `usuarios.id` | Administrador que revisa. |
| `fecha_revision` | `timestamptz(6)` | Si |  | Fecha de revision. |
| `observacion_revision` | `text` | Si |  | Observacion de revision. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `novedades_pkey`.
- FK `novedades_bus_id_fkey`, `novedades_conductor_id_fkey`, `novedades_revisada_por_id_fkey`.
- UQ compuesto `novedades_id_bus_id_key` para FK compuesta desde ordenes.
- IDX `novedades_bus_id_fecha_reporte_idx`, `novedades_conductor_id_fecha_reporte_idx`, `novedades_estado_idx`, `novedades_revisada_por_id_idx`.

---

## 8. `programaciones_mantenimiento`

RF-03, programaciones preventivas.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `bus_id` | `uuid` | No | FK -> `buses.id` | Bus programado. |
| `tipo` | `varchar(120)` | No |  | Tipo de mantenimiento. |
| `actividad` | `text` | No |  | Actividad preventiva esperada. |
| `criterio` | `criterio_mantenimiento` | No |  | `FECHA`, `KILOMETRAJE` o ambos. |
| `fecha_programada` | `date` | Si |  | Fecha objetivo si aplica. |
| `kilometraje_objetivo` | `integer` | Si |  | Kilometraje objetivo si aplica. |
| `activa` | `boolean` | No | `true` | Vigencia de la programacion. |
| `creada_por_id` | `uuid` | No | FK -> `usuarios.id` | Administrador creador. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `programaciones_mantenimiento_pkey`.
- FK `programaciones_mantenimiento_bus_id_fkey`.
- FK `programaciones_mantenimiento_creada_por_id_fkey`.
- UQ compuesto `programaciones_mantenimiento_id_bus_id_key` para FK compuesta desde ordenes.
- IDX `programaciones_mantenimiento_bus_id_activa_idx`, `programaciones_mantenimiento_creada_por_id_idx`.
- CHECK `ck_programaciones_mantenimiento_criterio`.

Uso RF-03:

- El estado visible se devuelve como clasificacion calculada; no existe columna fisica de estado preventivo.
- `creada_por_id` se obtiene desde la sesion del Administrador autenticado.
- `kilometraje_actual` no se almacena aqui ni se acepta desde cliente; se consulta desde `buses`.
- Una programacion con orden preventiva activa asociada no se reprograma desde RF-03.

---

## 9. `ordenes_trabajo`

RF-04, ordenes correctivas y preventivas.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `codigo` | `varchar(80)` | No | UQ | Codigo normalizado en mayusculas. |
| `bus_id` | `uuid` | No | FK -> `buses.id` | Bus de la orden. |
| `tipo` | `tipo_orden_trabajo` | No |  | `PREVENTIVA` o `CORRECTIVA`. |
| `origen` | `origen_orden_trabajo` | No |  | `PREVENTIVO`, `CORRECTIVO_DIRECTO`, `NOVEDAD`. |
| `prioridad` | `prioridad_orden` | No | `MEDIA` | Prioridad operativa. |
| `descripcion` | `text` | No |  | Descripcion de la orden. |
| `estado` | `estado_orden_trabajo` | No | `PENDIENTE_ASIGNACION` | Estado actual. |
| `tecnico_asignado_id` | `uuid` | Si | FK -> `usuarios.id` | Mecanico asignado desde `ASIGNADA`. |
| `creada_por_id` | `uuid` | No | FK -> `usuarios.id` | Usuario creador. |
| `fecha_creacion` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `fecha_asignacion` | `timestamptz(6)` | Si |  | Fecha de asignacion tecnica. |
| `fecha_inicio_ejecucion` | `timestamptz(6)` | Si |  | Inicio de trabajo tecnico. |
| `fecha_completada_tecnico` | `timestamptz(6)` | Si |  | Marca de completado por tecnico. |
| `fecha_cierre` | `timestamptz(6)` | Si |  | Cierre por administrador. |
| `cerrada_por_id` | `uuid` | Si | FK -> `usuarios.id` | Administrador que cierra. |
| `novedad_id` | `uuid` | Si | UQ, FK -> `novedades.id` | Novedad originadora. |
| `programacion_mantenimiento_id` | `uuid` | Si | FK -> `programaciones_mantenimiento.id` | Programacion originadora. |
| `fecha_objetivo_preventivo` | `date` | Si |  | Copia de fecha objetivo. |
| `kilometraje_objetivo_preventivo` | `integer` | Si |  | Copia de kilometraje objetivo. |
| `costo_total` | `decimal(12,2)` | No | `0`, derivado por trigger | Suma de subtotales de consumos. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `ordenes_trabajo_pkey`.
- UQ `ordenes_trabajo_codigo_key`, `ordenes_trabajo_novedad_id_key`.
- UQ funcional `ux_ordenes_trabajo_codigo_upper`.
- UQ parcial `ux_orden_preventiva_activa_programacion`.
- FKs simples a `buses`, `usuarios`, `novedades`, `programaciones_mantenimiento`.
- FK compuesta `ordenes_trabajo_novedad_bus_id_fkey`.
- FK compuesta `ordenes_trabajo_programacion_bus_id_fkey`.
- IDX `ordenes_trabajo_bus_id_estado_idx`, `cerrada_por_id_idx`, `creada_por_id_idx`, `programacion_mantenimiento_id_estado_idx`, `tecnico_asignado_id_estado_idx`.
- CHECK `ck_ordenes_origen_coherente`.
- CHECK `ck_ordenes_tecnico_segun_estado`.
- CHECK `ck_ordenes_cierre_responsable`.
- CHECK `ck_ordenes_ejecucion_minima`.
- CHECK `ck_ordenes_costos_km_no_negativos`.
- CHECK `ck_ordenes_codigo_normalizado`.
- CHECK `ck_ordenes_fechas_cronologicas`.
- Trigger `trg_ordenes_trabajo_cerrada_terminal`.
- Trigger `trg_ordenes_trabajo_set_costo_total`.

Uso RF-03:

- Las ordenes creadas desde programacion preventiva usan `tipo=PREVENTIVA`, `origen=PREVENTIVO` y estado inicial `PENDIENTE_ASIGNACION`.
- `tecnico_asignado_id` queda `NULL` en RF-03; la asignacion inicia en RF-04.
- `fecha_objetivo_preventivo` y `kilometraje_objetivo_preventivo` conservan una copia de los criterios de la programacion originadora.
- El historial inicial se registra en `orden_estado_historial` dentro de la misma transaccion.

---

## 10. `intervenciones`

Trabajo tecnico realizado en una orden.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `orden_trabajo_id` | `uuid` | No | FK -> `ordenes_trabajo.id` | Orden intervenida. |
| `tecnico_id` | `uuid` | No | FK -> `usuarios.id` | Mecanico responsable. |
| `fecha_inicio` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Inicio de intervencion. |
| `fecha_fin` | `timestamptz(6)` | Si |  | Fin de intervencion. |
| `diagnostico` | `text` | Si |  | Diagnostico tecnico. |
| `observaciones` | `text` | Si |  | Observaciones tecnicas. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `intervenciones_pkey`.
- FK `intervenciones_orden_trabajo_id_fkey`.
- FK `intervenciones_tecnico_id_fkey`.
- IDX `intervenciones_orden_trabajo_id_idx`, `intervenciones_tecnico_id_idx`.
- CHECK `ck_intervenciones_fechas`.

---

## 11. `actividades_orden`

Actividades registradas dentro de una intervencion.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `intervencion_id` | `uuid` | No | FK -> `intervenciones.id` | Intervencion asociada. |
| `descripcion` | `text` | No |  | Actividad realizada. |
| `fecha_registro` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de registro. |
| `registrada_por_id` | `uuid` | No | FK -> `usuarios.id` | Usuario que registra. |

Indices y restricciones:

- PK `actividades_orden_pkey`.
- FK `actividades_orden_intervencion_id_fkey`.
- FK `actividades_orden_registrada_por_id_fkey`.
- IDX `actividades_orden_intervencion_id_fecha_registro_idx`.
- IDX `actividades_orden_registrada_por_id_idx`.

---

## 12. `orden_estado_historial`

Tabla tecnica para auditoria de estados de orden.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `orden_trabajo_id` | `uuid` | No | FK -> `ordenes_trabajo.id` | Orden auditada. |
| `estado_anterior` | `estado_orden_trabajo` | Si |  | Estado previo. |
| `estado_nuevo` | `estado_orden_trabajo` | No |  | Estado posterior. |
| `cambiado_por_id` | `uuid` | No | FK -> `usuarios.id` | Usuario responsable. |
| `fecha_cambio` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de cambio. |
| `observacion` | `text` | Si |  | Observacion del cambio. |

Indices y restricciones:

- PK `orden_estado_historial_pkey`.
- FK `orden_estado_historial_orden_trabajo_id_fkey`.
- FK `orden_estado_historial_cambiado_por_id_fkey`.
- IDX `orden_estado_historial_orden_trabajo_id_fecha_cambio_idx`.
- IDX `orden_estado_historial_cambiado_por_id_idx`.

---

## 13. `orden_reasignaciones`

Tabla tecnica para auditoria de reasignacion de mecanico.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `orden_trabajo_id` | `uuid` | No | FK -> `ordenes_trabajo.id` | Orden reasignada. |
| `tecnico_anterior_id` | `uuid` | Si | FK -> `usuarios.id` | Mecanico anterior. |
| `tecnico_nuevo_id` | `uuid` | No | FK -> `usuarios.id` | Mecanico nuevo. |
| `reasignado_por_id` | `uuid` | No | FK -> `usuarios.id` | Administrador responsable. |
| `fecha_reasignacion` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de reasignacion. |
| `motivo` | `text` | Si |  | Justificacion. |

Indices y restricciones:

- PK `orden_reasignaciones_pkey`.
- FKs a `ordenes_trabajo` y `usuarios`.
- IDX `orden_reasignaciones_orden_trabajo_id_fecha_reasignacion_idx`.
- IDX `orden_reasignaciones_reasignado_por_id_idx`.
- IDX `orden_reasignaciones_tecnico_anterior_id_idx`.
- IDX `orden_reasignaciones_tecnico_nuevo_id_idx`.

---

## 14. `repuestos`

RF-05, catalogo e inventario de repuestos.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `codigo` | `varchar(80)` | No | UQ | Codigo normalizado en mayusculas. |
| `nombre` | `varchar(160)` | No |  | Nombre del repuesto. |
| `categoria` | `varchar(120)` | Si |  | Categoria opcional. |
| `unidad_medida` | `varchar(40)` | No |  | Unidad de stock. |
| `stock_actual` | `decimal(12,2)` | No | `0` | Existencia actual. |
| `stock_minimo` | `decimal(12,2)` | No | `0` | Umbral minimo. |
| `costo_unitario` | `decimal(12,2)` | No | `0` | Costo de referencia. |
| `estado` | `estado_repuesto` | No | `ACTIVO` | Estado del repuesto. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |
| `updated_at` | `timestamptz(6)` | No | Prisma `@updatedAt` | Ultima actualizacion. |

Indices y restricciones:

- PK `repuestos_pkey`.
- UQ `repuestos_codigo_key`.
- UQ funcional `ux_repuestos_codigo_upper`.
- IDX `repuestos_estado_idx`.
- CHECK `ck_repuestos_valores_no_negativos`.
- CHECK `ck_repuestos_codigo_normalizado`.

---

## 15. `consumos_repuesto`

Relacion oficial `OrdenTrabajo -> ConsumoRepuesto -> Repuesto`.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `orden_trabajo_id` | `uuid` | No | FK -> `ordenes_trabajo.id` | Orden que consume. |
| `repuesto_id` | `uuid` | No | FK -> `repuestos.id` | Repuesto consumido. |
| `cantidad` | `decimal(12,2)` | No |  | Cantidad consumida. |
| `costo_unitario` | `decimal(12,2)` | No |  | Costo historico al consumir. |
| `subtotal` | `decimal(12,2)` | No | Calculado | `cantidad * costo_unitario`. |
| `consumido_por_id` | `uuid` | No | FK -> `usuarios.id` | Mecanico responsable. |
| `fecha_consumo` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de consumo. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |

Indices y restricciones:

- PK `consumos_repuesto_pkey`.
- FK `consumos_repuesto_orden_trabajo_id_fkey`.
- FK `consumos_repuesto_repuesto_id_fkey`.
- FK `consumos_repuesto_consumido_por_id_fkey`.
- UQ compuesto `consumos_repuesto_id_repuesto_id_key` para coherencia con movimiento.
- IDX `consumos_repuesto_orden_trabajo_id_idx`, `repuesto_id_idx`, `consumido_por_id_idx`.
- CHECK `ck_consumos_repuesto_valores`.
- CHECK `ck_consumos_repuesto_subtotal_calculado`.
- Trigger `trg_consumos_repuesto_recalcular_costo_total`.
- Constraint trigger `trg_consumos_repuesto_movimiento_unico`.

---

## 16. `movimientos_inventario`

Historial de movimientos de stock.

| Campo | Tipo | Nulo | Clave/default | Descripcion |
|---|---|---:|---|---|
| `id` | `uuid` | No | PK, `uuid()` | Identificador tecnico. |
| `repuesto_id` | `uuid` | No | FK -> `repuestos.id` | Repuesto afectado. |
| `tipo` | `tipo_movimiento_inventario` | No |  | `ENTRADA`, `CONSUMO`, `AJUSTE_ENTRADA`, `AJUSTE_SALIDA`. |
| `cantidad` | `decimal(12,2)` | No |  | Cantidad positiva del movimiento. |
| `costo_unitario` | `decimal(12,2)` | Si |  | Costo unitario si aplica. |
| `motivo` | `text` | Si | Obligatorio para entrada/ajuste | Motivo administrativo o soporte. |
| `responsable_id` | `uuid` | No | FK -> `usuarios.id` | Usuario responsable del movimiento. |
| `consumo_repuesto_id` | `uuid` | Si | UQ, FK -> `consumos_repuesto.id` | Consumo asociado cuando `tipo = CONSUMO`. |
| `fecha_movimiento` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha del movimiento. |
| `created_at` | `timestamptz(6)` | No | `CURRENT_TIMESTAMP` | Fecha de creacion. |

Indices y restricciones:

- PK `movimientos_inventario_pkey`.
- FK `movimientos_inventario_repuesto_id_fkey`.
- FK `movimientos_inventario_responsable_id_fkey`.
- FK `movimientos_inventario_consumo_repuesto_id_fkey`.
- FK compuesta `movimientos_inventario_consumo_repuesto_id_repuesto_id_fkey`.
- UQ `movimientos_inventario_consumo_repuesto_id_key`.
- IDX `movimientos_inventario_fecha_movimiento_idx`.
- IDX `movimientos_inventario_repuesto_id_fecha_movimiento_idx`.
- IDX `movimientos_inventario_responsable_id_idx`.
- CHECK `ck_movimientos_inventario_valores`.
- CHECK `ck_movimientos_inventario_consumo`.
- CHECK `ck_movimientos_inventario_motivo_administrativo`.
- Constraint trigger `trg_movimientos_inventario_consumo_unico`.

---

## Enums fisicos

| Enum | Valores |
|---|---|
| `rol_codigo` | `ADMINISTRADOR`, `MECANICO`, `CONDUCTOR` |
| `estado_usuario` | `ACTIVO`, `INACTIVO` |
| `estado_bus` | `OPERATIVO`, `EN_MANTENIMIENTO`, `FUERA_DE_SERVICIO`, `INACTIVO` |
| `estado_novedad` | `PENDIENTE_REVISION`, `RESUELTA_SIN_ORDEN`, `DESCARTADA`, `CONVERTIDA_A_ORDEN` |
| `criterio_mantenimiento` | `FECHA`, `KILOMETRAJE`, `FECHA_KILOMETRAJE` |
| `tipo_orden_trabajo` | `PREVENTIVA`, `CORRECTIVA` |
| `origen_orden_trabajo` | `PREVENTIVO`, `CORRECTIVO_DIRECTO`, `NOVEDAD` |
| `prioridad_orden` | `BAJA`, `MEDIA`, `ALTA` |
| `estado_orden_trabajo` | `PENDIENTE_ASIGNACION`, `ASIGNADA`, `EN_EJECUCION`, `COMPLETADA_TECNICO`, `DEVUELTA_CORRECCION`, `CERRADA` |
| `estado_repuesto` | `ACTIVO`, `INACTIVO` |
| `tipo_movimiento_inventario` | `ENTRADA`, `CONSUMO`, `AJUSTE_ENTRADA`, `AJUSTE_SALIDA` |

---

## Notas de integridad

- `Informe` no aparece porque se implementa como consulta/servicio/DTO/vista derivada.
- Los estados calculados de mantenimiento preventivo `VIGENTE`, `PROXIMO` y `VENCIDO` no se persisten como columna.
- `costo_total` existe como dato fisico derivado por triggers para evitar que dependa de valores enviados por cliente.
- El descuento de stock queda como responsabilidad del servicio transaccional; PostgreSQL impide stock negativo.
