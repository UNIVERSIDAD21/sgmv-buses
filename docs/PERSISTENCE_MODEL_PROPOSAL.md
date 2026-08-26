# Propuesta de modelo de persistencia Prisma/PostgreSQL

**Estado:** PROPUESTA DOCUMENTAL ALINEADA CON DIAGRAMAS DE FASE 2
**Bloque:** 2 - Persistencia
**Fecha de alineación:** 2026-08-26
**Alcance:** documentación técnica. No modifica `schema.prisma`, no crea migraciones, no conecta Neon, no crea seed y no implementa repositorios ni servicios.

---

## 1. Base oficial

Esta propuesta baja el diagrama de clases oficial de Fase 2 a una estructura futura implementable con Prisma ORM sobre PostgreSQL/Neon.

Artefactos oficiales guardados sin alterar:

- `docs/diagrams/diagrama-casos-uso-fase-2.png`
- `docs/diagrams/diagrama-clases-fase-2.png`

Cuando una relación visual sea ambigua por cruces o distribución, prevalecen:

1. La instrucción textual oficial del propietario del 2026-08-26.
2. `docs/DECISIONS.md`.
3. `docs/BUSINESS_RULES.md`.
4. El resto de documentación versionada según `AGENTS.md`.

La propuesta respeta:

- exactamente tres roles funcionales;
- exactamente seis RF oficiales;
- exactamente cuatro RNF;
- autenticación y autorización como capacidades transversales;
- historial derivado desde datos reales y validados;
- alcance sin GPS, IA, telemetría, rutas, recaudo, ERP ni contabilidad completa.

---

## 2. Convenciones técnicas propuestas

Estas convenciones son técnicas y no redefinen el diseño conceptual:

- PK técnica UUID en tablas principales y técnicas.
- Tablas físicas en `snake_case` mediante `@@map`.
- Campos Prisma en `camelCase`.
- Fechas/hora operativas con `DateTime` respaldado por PostgreSQL `timestamptz`.
- Fechas de calendario, si aplica, con tipo `date`.
- Cantidades, costos y subtotales con `Decimal`.
- Enums para estados controlados.
- Índices únicos parciales en PostgreSQL cuando Prisma no exprese directamente la regla.
- Transacciones Prisma para reasignaciones, generación/cierre de órdenes preventivas y consumos de repuestos.

Los tipos `int`, `String` y `boolean` del diagrama son conceptuales; esta propuesta conserva su significado.

---

## 3. RF oficiales que no se pueden renombrar

1. RF-01 — Gestión de la flota vehicular.
2. RF-02 — Control de novedades operativas.
3. RF-03 — Administración del mantenimiento preventivo.
4. RF-04 — Seguimiento de órdenes de trabajo.
5. RF-05 — Central de Repuestos.
6. RF-06 — Consulta de historial y generación de informes.

No existe RF-07. La autenticación, cierre de sesión, gestión mínima de cuentas, autorización y protección de rutas siguen siendo transversales.

---

## 4. Enums de dominio y técnicos

### `RolCodigo`

- `ADMIN_SUPERVISOR`
- `MECANICO`
- `CONDUCTOR_OPERADOR`

Representa los tres roles funcionales exactos del sistema.

### `EstadoNovedad`

- `PENDIENTE_REVISION`
- `RESUELTA_SIN_ORDEN`
- `DESCARTADA`
- `CONVERTIDA_A_ORDEN`

### Estado calculado de ProgramacionMantenimiento

Valores de consulta:

- `VIGENTE`
- `PROXIMO`
- `VENCIDO`

No se recomienda persistirlos como columna de verdad durable porque dependen de fecha actual y kilometraje actual. Deben calcularse en consulta/servicio/DTO.

Regla aprobada:

- `VENCIDO` si cualquier criterio aplicable está vencido.
- `PROXIMO` si ninguno está vencido y al menos un criterio aplicable está dentro del umbral.
- `VIGENTE` si no está vencido ni próximo.

Umbrales:

- 7 días calendario.
- 500 km.

### `TipoOrdenTrabajo`

- `PREVENTIVA`
- `CORRECTIVA`

### `OrigenOrdenTrabajo`

- `PREVENTIVO`
- `CORRECTIVO_DIRECTO`
- `NOVEDAD`

### `EstadoOrdenTrabajo`

- `PENDIENTE_ASIGNACION`
- `ASIGNADA`
- `EN_EJECUCION`
- `COMPLETADA_TECNICO`
- `DEVUELTA_CORRECCION`
- `CERRADA`

`CERRADA` es terminal. Solo el Supervisor cierra órdenes. Solo el Mecánico marca la ejecución como completada.

### Enums técnicos propuestos

Estos nombres no crean procesos de negocio:

- `EstadoUsuario`: `ACTIVO`, `INACTIVO`.
- `EstadoBus`: `OPERATIVO`, `EN_MANTENIMIENTO`, `FUERA_DE_SERVICIO`, `INACTIVO`.
- `CriterioMantenimiento`: `FECHA`, `KILOMETRAJE`, `FECHA_KILOMETRAJE`.
- `PrioridadOrden`: `BAJA`, `MEDIA`, `ALTA`.
- `EstadoRepuesto`: `ACTIVO`, `INACTIVO`.
- `TipoMovimientoInventario`: `ENTRADA`, `CONSUMO`, `AJUSTE_ENTRADA`, `AJUSTE_SALIDA`.

La cantidad de inventario se almacena positiva; el tipo define si suma o descuenta stock.

---

## 5. Modelos propuestos

### 5.1 `Rol`

Propósito: soportar autorización transversal sin crear RF adicional.

Campos:

- `id`: UUID, PK.
- `codigo`: `RolCodigo`, único.
- `nombre`: texto.
- `descripcion`: texto opcional.
- `createdAt`, `updatedAt`.

Relaciones:

- `Rol` 1 -> 0..* `Usuario`.

Restricciones:

- Semilla fija con los tres roles aprobados.
- No crear roles funcionales adicionales.

---

### 5.2 `Usuario`

Propósito: representar cuentas mínimas y su rol funcional.

Campos:

- `id`: UUID, PK.
- `nombre`: texto.
- `email`: texto único y normalizado.
- `telefono`: texto opcional.
- `contrasenaHash`: texto obligatorio.
- `estado`: `EstadoUsuario`.
- `rolId`: FK a `Rol`.
- `intentosFallidosLogin`: entero técnico.
- `bloqueadoHasta`: fecha/hora opcional.
- `ultimoAccesoAt`: fecha/hora opcional.
- `createdAt`, `updatedAt`.

Relaciones:

- Pertenece exactamente a un Rol.
- Como Conductor/Operador participa en AsignacionConductor y Novedad.
- Como Personal Técnico/Mecánico puede ser técnico asignado de OrdenTrabajo e Intervencion.
- Como responsable puede aparecer en movimientos, reasignaciones y auditorías.

Validaciones de backend:

- Usuario inactivo no inicia sesión.
- Solo `ADMIN_SUPERVISOR` gestiona cuentas mínimas.
- No registrar contraseñas, hashes ni tokens en logs.
- Las FK dependientes de rol se validan en servicios.

---

### 5.3 `Bus`

Propósito: base de RF-01 — Gestión de la flota vehicular.

Campos:

- `id`: UUID, PK.
- `codigoInterno`: texto único.
- `placa`: texto único.
- `marca`: texto.
- `modelo`: texto.
- `anio`: entero.
- `kilometrajeActual`: entero no negativo.
- `estadoOperativo`: `EstadoBus`.
- `createdAt`, `updatedAt`.

Relaciones:

- `Bus` 1 -> 0..* `AsignacionConductor`.
- `Bus` 1 -> 0..* `LecturaKilometraje`.
- `Bus` 1 -> 0..* `BusEstadoHistorial` si se implementa.
- `Bus` 1 -> 0..* `Novedad`.
- `Bus` 1 -> 0..* `ProgramacionMantenimiento`.
- `Bus` 1 -> 0..* `OrdenTrabajo`.

Restricciones:

- Evitar borrado físico cuando exista trazabilidad.
- El conductor solo puede consultar el bus de su asignación activa.

---

### 5.4 `LecturaKilometraje`

Tabla técnica permitida para trazabilidad de RF-01 y soporte de RF-03.

Campos:

- `id`: UUID, PK.
- `busId`: FK a `Bus`.
- `kilometrajeAnterior`: entero.
- `kilometrajeNuevo`: entero.
- `registradoPorId`: FK a `Usuario`.
- `fechaRegistro`: fecha/hora.
- `motivo`: texto opcional.

Reglas:

- No crea un módulo nuevo.
- Conserva responsable y fecha.
- `kilometrajeNuevo >= kilometrajeAnterior`, salvo ajuste administrativo justificado si se autoriza.

---

### 5.5 `BusEstadoHistorial`

Tabla técnica permitida si se decide auditar cambios de estado operativo del bus.

Campos:

- `id`: UUID, PK.
- `busId`: FK a `Bus`.
- `estadoAnterior`: `EstadoBus` opcional.
- `estadoNuevo`: `EstadoBus`.
- `cambiadoPorId`: FK a `Usuario`.
- `fechaCambio`: fecha/hora.
- `motivo`: texto opcional.

Reglas:

- No crea un nuevo RF.
- Solo registra trazabilidad de RF-01.
- Puede omitirse de la primera migración si se decide auditar el estado en otra estructura equivalente.

---

### 5.6 `AsignacionConductor`

Propósito: conservar historial conductor-bus y determinar permisos del conductor.

Campos:

- `id`: UUID, PK.
- `conductorId`: FK a `Usuario`.
- `busId`: FK a `Bus`.
- `fechaInicio`: fecha/hora.
- `fechaFin`: fecha/hora opcional.
- `activa`: boolean.
- `asignadoPorId`: FK a `Usuario`.
- `motivo`: texto opcional.
- `createdAt`, `updatedAt`.

Relaciones:

- Cada AsignacionConductor pertenece a un Usuario conductor.
- Cada AsignacionConductor pertenece a un Bus.
- Un conductor puede tener muchas asignaciones históricas.
- Un bus puede tener muchas asignaciones históricas.

Restricciones:

- Máximo una asignación activa por conductor.
- Máximo una asignación activa por bus.
- Si `activa=true`, `fechaFin` debe ser `NULL`.
- Si `activa=false`, `fechaFin` debe existir.

Índices parciales PostgreSQL recomendados:

```sql
CREATE UNIQUE INDEX ux_asignacion_conductor_activa
ON asignaciones_conductor (conductor_id)
WHERE activa = true;

CREATE UNIQUE INDEX ux_asignacion_bus_activa
ON asignaciones_conductor (bus_id)
WHERE activa = true;
```

Transacción de reasignación:

1. Validar rol `ADMIN_SUPERVISOR`.
2. Validar conductor.
3. Cerrar asignación activa previa del conductor.
4. Cerrar asignación activa previa del bus.
5. Crear nueva asignación activa.
6. Confirmar transacción.

---

### 5.7 `Novedad`

Propósito: RF-02 — Control de novedades operativas.

Campos:

- `id`: UUID, PK.
- `conductorId`: FK a `Usuario`.
- `busId`: FK a `Bus`.
- `fechaReporte`: fecha/hora generada por el sistema.
- `tipo`: texto.
- `descripcion`: texto.
- `clasificacion`: texto opcional.
- `estado`: `EstadoNovedad`.
- `revisadaPorId`: FK opcional a `Usuario`.
- `fechaRevision`: fecha/hora opcional.
- `observacionRevision`: texto opcional.
- `createdAt`, `updatedAt`.

Relaciones:

- Cada Novedad pertenece exactamente al conductor autor.
- Cada Novedad pertenece exactamente a un Bus.
- Una Novedad puede generar cero o una OrdenTrabajo.

Reglas:

- Autor desde sesión.
- Bus desde asignación activa.
- `OrdenTrabajo.novedadId` opcional y único.
- Si `origen = NOVEDAD`, `novedadId` es obligatorio.
- Si `origen != NOVEDAD`, `novedadId` debe ser `NULL`.

Conversión a orden:

1. Validar que la novedad esté en `PENDIENTE_REVISION`.
2. Validar rol `ADMIN_SUPERVISOR`.
3. Crear OrdenTrabajo correctiva con `origen = NOVEDAD`.
4. Cambiar novedad a `CONVERTIDA_A_ORDEN`.
5. Guardar responsable y fecha.
6. Confirmar transacción.

La unicidad de `novedadId` evita órdenes duplicadas.

---

### 5.8 `ProgramacionMantenimiento`

Propósito: RF-03 — Administración del mantenimiento preventivo.

Campos persistidos:

- `id`: UUID, PK.
- `busId`: FK a `Bus`.
- `tipo`: texto.
- `actividad`: texto.
- `criterio`: `CriterioMantenimiento`.
- `fechaProgramada`: fecha opcional.
- `kilometrajeObjetivo`: entero opcional.
- `activa`: boolean.
- `creadaPorId`: FK a `Usuario`.
- `createdAt`, `updatedAt`.

Campo no persistido como verdad durable:

- `estadoSeguimiento`: `VIGENTE`, `PROXIMO` o `VENCIDO`, calculado al consultar.

Relaciones:

- Pertenece exactamente a un Bus.
- Puede generar cero o muchas OrdenTrabajo preventivas históricas.
- Cada OrdenTrabajo preventiva pertenece exactamente a una ProgramacionMantenimiento.

Restricciones:

- Debe existir al menos `fechaProgramada` o `kilometrajeObjetivo`.
- `FECHA` requiere fecha.
- `KILOMETRAJE` requiere kilometraje.
- `FECHA_KILOMETRAJE` requiere ambos.
- `kilometrajeObjetivo > 0` cuando aplique.

Regla oficial:

- Una programación puede generar varias órdenes históricas.
- Solo puede existir una orden activa simultáneamente por programación.
- Al generar una orden se conserva copia de la fecha y/o kilometraje objetivo que la originó.
- Al cerrar una orden preventiva se registra el siguiente objetivo si la programación continúa activa.

Índice parcial recomendado:

```sql
CREATE UNIQUE INDEX ux_orden_preventiva_activa_por_programacion
ON ordenes_trabajo (programacion_mantenimiento_id)
WHERE programacion_mantenimiento_id IS NOT NULL
  AND estado <> 'CERRADA';
```

---

### 5.9 `OrdenTrabajo`

Propósito: RF-04 — Seguimiento de órdenes de trabajo.

Campos:

- `id`: UUID, PK.
- `codigo`: texto único legible.
- `busId`: FK a `Bus`.
- `tipo`: `TipoOrdenTrabajo`.
- `origen`: `OrigenOrdenTrabajo`.
- `prioridad`: `PrioridadOrden`.
- `descripcion`: texto.
- `estado`: `EstadoOrdenTrabajo`.
- `tecnicoAsignadoId`: FK opcional a `Usuario`.
- `creadaPorId`: FK a `Usuario`.
- `fechaCreacion`: fecha/hora.
- `fechaAsignacion`: fecha/hora opcional.
- `fechaInicioEjecucion`: fecha/hora opcional.
- `fechaCompletadaTecnico`: fecha/hora opcional.
- `fechaCierre`: fecha/hora opcional.
- `cerradaPorId`: FK opcional a `Usuario`.
- `novedadId`: FK opcional y única a `Novedad`.
- `programacionMantenimientoId`: FK opcional a `ProgramacionMantenimiento`.
- `fechaObjetivoPreventivo`: fecha opcional.
- `kilometrajeObjetivoPreventivo`: entero opcional.
- `costoTotal`: decimal.
- `createdAt`, `updatedAt`.

Relaciones:

- Pertenece exactamente a un Bus.
- Puede no tener Novedad.
- Si es preventiva, pertenece exactamente a una ProgramacionMantenimiento.
- Puede estar inicialmente sin técnico.
- Desde `ASIGNADA` debe tener exactamente un técnico.
- Contiene cero o muchas Intervencion.
- Tiene cero o muchos ConsumoRepuesto.
- Tiene cambios auditados en OrdenEstadoHistorial.
- Tiene reasignaciones auditadas en OrdenReasignacion.

Restricciones de origen:

- `origen = NOVEDAD` requiere `novedadId` y `tipo = CORRECTIVA`.
- `origen = PREVENTIVO` requiere `programacionMantenimientoId` y `tipo = PREVENTIVA`.
- `origen = CORRECTIVO_DIRECTO` no debe tener `novedadId` ni `programacionMantenimientoId`.
- Una orden no puede tener simultáneamente `novedadId` y `programacionMantenimientoId`.
- Si es preventiva, debe conservar `fechaObjetivoPreventivo`, `kilometrajeObjetivoPreventivo` o ambos según la programación que la originó.

Reglas de estado:

- `PENDIENTE_ASIGNACION` permite `tecnicoAsignadoId = NULL`.
- Desde `ASIGNADA` hasta `CERRADA`, `tecnicoAsignadoId` debe existir.
- Para pasar a `COMPLETADA_TECNICO` debe existir al menos una ActividadOrden registrada.
- En órdenes correctivas, diagnóstico obligatorio.
- Solo el Mecánico marca `COMPLETADA_TECNICO`.
- Solo el Supervisor cierra.
- `CERRADA` requiere `fechaCierre` y `cerradaPorId`.
- `CERRADA` es terminal.

---

### 5.10 `Intervencion`

Propósito: registrar el trabajo técnico del Mecánico.

Campos:

- `id`: UUID, PK.
- `ordenTrabajoId`: FK a `OrdenTrabajo`.
- `tecnicoId`: FK a `Usuario`.
- `fechaInicio`: fecha/hora.
- `fechaFin`: fecha/hora opcional.
- `diagnostico`: texto opcional.
- `observaciones`: texto opcional.
- `createdAt`, `updatedAt`.

Relaciones:

- Pertenece exactamente a una OrdenTrabajo.
- Identifica exactamente al Mecánico responsable.
- Contiene cero o muchas ActividadOrden.

Reglas:

- `fechaFin >= fechaInicio` cuando exista.
- Una nueva intervención puede registrar trabajo de corrección si la orden fue devuelta.
- El diagnóstico se exige para correctivas antes de `COMPLETADA_TECNICO`.

---

### 5.11 `ActividadOrden`

Propósito: registrar actividades estructuradas dentro de una intervención.

Campos:

- `id`: UUID, PK.
- `intervencionId`: FK a `Intervencion`.
- `descripcion`: texto.
- `fechaRegistro`: fecha/hora.
- `registradaPorId`: FK a `Usuario`.

Relaciones:

- Pertenece exactamente a una Intervencion.
- Identifica usuario responsable de registrar.

Regla:

- Para marcar una orden como `COMPLETADA_TECNICO` debe existir al menos una actividad en sus intervenciones.

---

### 5.12 `OrdenEstadoHistorial`

Tabla técnica permitida para auditar cambios de estado de órdenes.

Campos:

- `id`: UUID, PK.
- `ordenTrabajoId`: FK a `OrdenTrabajo`.
- `estadoAnterior`: `EstadoOrdenTrabajo` opcional.
- `estadoNuevo`: `EstadoOrdenTrabajo`.
- `cambiadoPorId`: FK a `Usuario`.
- `fechaCambio`: fecha/hora.
- `observacion`: texto opcional.

Reglas:

- No crea RF adicional.
- Conserva responsable y fecha.
- Las transiciones se validan en servicio.

---

### 5.13 `OrdenReasignacion`

Tabla técnica permitida para auditar reasignaciones de técnico.

Campos:

- `id`: UUID, PK.
- `ordenTrabajoId`: FK a `OrdenTrabajo`.
- `tecnicoAnteriorId`: FK opcional a `Usuario`.
- `tecnicoNuevoId`: FK a `Usuario`.
- `reasignadoPorId`: FK a `Usuario`.
- `fechaReasignacion`: fecha/hora.
- `motivo`: texto opcional.

Reglas:

- Solo `ADMIN_SUPERVISOR` reasigna.
- `tecnicoNuevoId` debe tener rol `MECANICO`.
- Se ejecuta en transacción junto con la actualización de `OrdenTrabajo.tecnicoAsignadoId`.

---

### 5.14 `Repuesto`

Propósito: RF-05 — Central de Repuestos.

Campos:

- `id`: UUID, PK.
- `codigo`: texto único.
- `nombre`: texto.
- `categoria`: texto opcional.
- `unidadMedida`: texto.
- `stockActual`: decimal.
- `stockMinimo`: decimal.
- `costoUnitario`: decimal.
- `estado`: `EstadoRepuesto`.
- `createdAt`, `updatedAt`.

Relaciones:

- `Repuesto` 1 -> 0..* `ConsumoRepuesto`.
- `Repuesto` 1 -> 0..* `MovimientoInventario`.

Restricciones:

- `stockActual >= 0`.
- `stockMinimo >= 0`.
- `costoUnitario >= 0`.

---

### 5.15 `ConsumoRepuesto`

Propósito: relacionar repuestos consumidos con órdenes y conservar costo histórico.

Campos:

- `id`: UUID, PK.
- `ordenTrabajoId`: FK a `OrdenTrabajo`.
- `repuestoId`: FK a `Repuesto`.
- `cantidad`: decimal.
- `costoUnitario`: decimal histórico.
- `subtotal`: decimal histórico.
- `consumidoPorId`: FK a `Usuario`.
- `fechaConsumo`: fecha/hora.
- `createdAt`.

Relaciones oficiales:

- Pertenece exactamente a una OrdenTrabajo.
- Corresponde exactamente a un Repuesto.
- Genera exactamente un MovimientoInventario de tipo consumo.

Reglas:

- La relación correcta es `OrdenTrabajo → ConsumoRepuesto → Repuesto`.
- No implementar relación directa OrdenTrabajo-Repuesto que ignore ConsumoRepuesto.
- El consumo es opcional para una orden.
- El Mecánico solo consume repuestos en órdenes autorizadas.
- Consumo, movimiento y descuento de stock ocurren en una sola transacción.

---

### 5.16 `MovimientoInventario`

Propósito: registrar cambios de stock.

Campos:

- `id`: UUID, PK.
- `repuestoId`: FK a `Repuesto`.
- `tipo`: `TipoMovimientoInventario`.
- `cantidad`: decimal.
- `costoUnitario`: decimal opcional.
- `motivo`: texto opcional.
- `responsableId`: FK a `Usuario`.
- `consumoRepuestoId`: FK opcional y única a `ConsumoRepuesto`.
- `fechaMovimiento`: fecha/hora.
- `createdAt`.

Relaciones:

- Pertenece exactamente a un Repuesto.
- Identifica exactamente al Usuario responsable.
- Si `tipo = CONSUMO`, pertenece exactamente a un ConsumoRepuesto.
- Si es entrada o ajuste, no necesita ConsumoRepuesto.

Restricciones:

- `cantidad > 0`.
- `tipo = CONSUMO` requiere `consumoRepuestoId`.
- `tipo != CONSUMO` requiere `consumoRepuestoId = NULL`.
- Entrada y ajustes administrativos los registra Administrador/Supervisor.
- Consumos autorizados los registra Mecánico.

Nota importante:

- No se propone `ordenTrabajoId` en MovimientoInventario. La orden se obtiene por `MovimientoInventario → ConsumoRepuesto → OrdenTrabajo` cuando el movimiento es consumo.

---

### 5.17 `Informe`

No crear tabla `Informe` en la primera migración.

Implementación esperada:

- Servicio de consulta.
- DTO/view model.
- Endpoint de reporte.
- Vista SQL opcional si después se justifica por rendimiento.

Fuentes consultadas:

- Bus.
- AsignacionConductor cuando aporte contexto.
- Novedad.
- ProgramacionMantenimiento.
- OrdenTrabajo.
- Intervencion.
- ActividadOrden.
- ConsumoRepuesto.
- Repuesto.
- MovimientoInventario.

Reglas:

- RF-06 no modifica datos históricos.
- El conductor solo ve resumen autorizado de su bus.
- El mecánico solo ve historial técnico necesario.
- El supervisor puede ver historial e informes permitidos, incluidos costos básicos trazables.

---

## 6. Cardinalidades resumidas

```text
Rol 1 -> 0..* Usuario

Usuario(Conductor) 1 -> 0..* AsignacionConductor
Bus                 1 -> 0..* AsignacionConductor

Bus                 1 -> 0..* LecturaKilometraje
Bus                 1 -> 0..* BusEstadoHistorial

Usuario(Conductor) 1 -> 0..* Novedad
Bus                 1 -> 0..* Novedad
Novedad             1 -> 0..1 OrdenTrabajo

Bus                       1 -> 0..* ProgramacionMantenimiento
ProgramacionMantenimiento 1 -> 0..* OrdenTrabajo preventivas históricas
ProgramacionMantenimiento 1 -> 0..1 OrdenTrabajo preventiva activa

Bus                 1 -> 0..* OrdenTrabajo
Usuario(Mecánico)   1 -> 0..* OrdenTrabajo asignadas

OrdenTrabajo        1 -> 0..* Intervencion
Intervencion        1 -> 0..* ActividadOrden
OrdenTrabajo        1 -> 0..* OrdenEstadoHistorial
OrdenTrabajo        1 -> 0..* OrdenReasignacion

OrdenTrabajo        1 -> 0..* ConsumoRepuesto
ConsumoRepuesto     * -> 1 Repuesto
ConsumoRepuesto     1 -> 1 MovimientoInventario de consumo
Repuesto            1 -> 0..* MovimientoInventario
Usuario             1 -> 0..* MovimientoInventario como responsable
```

---

## 7. Restricciones UNIQUE recomendadas

- `rol.codigo`.
- `usuario.email`.
- `bus.codigoInterno`.
- `bus.placa`.
- `repuesto.codigo`.
- `orden_trabajo.codigo`.
- `orden_trabajo.novedad_id`, cuando no sea `NULL`.
- Índice único parcial de asignación activa por conductor.
- Índice único parcial de asignación activa por bus.
- Índice único parcial de orden preventiva activa por programación.
- `movimiento_inventario.consumo_repuesto_id`, cuando no sea `NULL`.

---

## 8. Restricciones CHECK recomendadas

- Kilometrajes `>= 0`.
- Cantidades de consumo/movimiento `> 0`.
- Stocks y costos `>= 0`.
- Programación con al menos fecha o kilometraje.
- Programación coherente con su criterio.
- Asignación activa sin `fechaFin`.
- Asignación cerrada con `fechaFin`.
- Intervención con `fechaFin >= fechaInicio` cuando exista.
- Orden con origen coherente.
- Orden preventiva con copia del objetivo aplicable.
- Orden cerrada con `fechaCierre` y `cerradaPorId`.
- Movimiento tipo `CONSUMO` con `consumoRepuestoId`.
- Movimiento no consumo sin `consumoRepuestoId`.

Reglas de servicio/transacción, no de `CHECK` simple:

- Validar rol de usuarios referenciados.
- Validar transiciones de estado.
- Exigir diagnóstico en correctivas.
- Exigir al menos una actividad antes de `COMPLETADA_TECNICO`.
- Evitar stock negativo bajo concurrencia.
- Cerrar preventiva actualizando siguiente objetivo si la programación continúa activa.

---

## 9. Transacciones críticas

### Reasignación conductor-bus

1. Validar `ADMIN_SUPERVISOR`.
2. Validar conductor.
3. Cerrar asignación activa previa del conductor.
4. Cerrar asignación activa previa del bus.
5. Crear nueva asignación activa.
6. Confirmar.

### Conversión de novedad a orden

1. Leer novedad pendiente.
2. Validar que no exista orden asociada.
3. Crear orden correctiva con `origen = NOVEDAD`.
4. Actualizar novedad a `CONVERTIDA_A_ORDEN`.
5. Registrar responsable y fecha.
6. Confirmar.

### Generación de orden preventiva

1. Validar programación activa.
2. Calcular estado preventivo con fecha/kilometraje actuales.
3. Validar que no exista orden activa para la programación.
4. Crear OrdenTrabajo preventiva.
5. Copiar fecha y/o kilometraje objetivo que originó la orden.
6. Confirmar.

### Cierre de orden preventiva

1. Validar `COMPLETADA_TECNICO`.
2. Validar `ADMIN_SUPERVISOR`.
3. Validar información técnica mínima.
4. Registrar siguiente fecha/kilometraje objetivo si la programación continúa activa.
5. Cambiar orden a `CERRADA`.
6. Registrar historial de estado.
7. Confirmar.

### Consumo de repuesto

1. Validar permisos.
2. Validar orden autorizada.
3. Validar repuesto activo.
4. Validar cantidad y stock suficiente.
5. Crear ConsumoRepuesto.
6. Crear MovimientoInventario tipo `CONSUMO`.
7. Descontar stock.
8. Actualizar subtotal/costo trazable si aplica.
9. Confirmar.

---

## 10. Estrategia para Prisma/PostgreSQL

Prisma modelará:

- Modelos.
- Relaciones.
- PK/FK.
- `@unique`.
- `@@index`.
- Defaults.
- Cliente tipado.
- Transacciones.

PostgreSQL mediante SQL en migraciones Prisma modelará:

- Índices únicos parciales.
- `CHECK` complejos.
- Integridad que Prisma no expresa directamente.

Backend con Zod y servicios modelará:

- Permisos por rol.
- Transiciones de estado.
- Validación de rol en FK.
- Reglas dependientes de varias tablas.
- Idempotencia operacional.
- Protección CSRF/equivalente.
- Mensajes de error controlados.

---

## 11. Pendiente antes de implementar

Esta propuesta queda lista para revisión documental, pero no autoriza implementación.

Antes de tocar `schema.prisma`, crear migraciones, conectar Neon, crear seed o implementar repositorios/servicios, se requiere aprobación explícita del propietario para iniciar Persistencia.

Puntos técnicos a confirmar en esa aprobación:

1. Usar UUID como PK técnica.
2. Usar los enums técnicos propuestos.
3. Incluir `LecturaKilometraje` desde la primera migración.
4. Incluir `OrdenEstadoHistorial` desde la primera migración.
5. Incluir `OrdenReasignacion` desde la primera migración.
6. Decidir si `BusEstadoHistorial` entra en la primera migración o queda como tabla técnica opcional posterior.

No quedan pendientes funcionales para redefinir RF, actores, clases principales ni relaciones oficiales.
