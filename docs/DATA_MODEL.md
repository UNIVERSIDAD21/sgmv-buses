# Modelo de datos para Fase 3

## 1. Propósito

Este documento traduce el diagrama de clases oficial de Fase 2 a una guía de persistencia para PostgreSQL/Neon y Prisma.

No reemplaza los diagramas de Fase 2. Los artefactos oficiales recibidos el 2026-08-26 quedaron guardados sin alterar en:

- `docs/diagrams/diagrama-casos-uso-fase-2.png`
- `docs/diagrams/diagrama-clases-fase-2.png`

Si una línea visual del diagrama resulta ambigua por cruces o distribución, prevalece la interpretación textual aprobada por el propietario y las decisiones registradas en `docs/DECISIONS.md` y `docs/BUSINESS_RULES.md`.

Los tipos `int`, `String` y `boolean` del diagrama son conceptuales. La implementación puede usar UUID, enums, `Decimal`, `date` y `timestamptz` cuando sea técnicamente conveniente, siempre que no cambie el significado del diseño.

---

## 2. Casos de uso/RF oficiales

El sistema conserva exactamente seis RF principales:

1. RF-01 — Gestión de la flota vehicular.
2. RF-02 — Control de novedades operativas.
3. RF-03 — Administración del mantenimiento preventivo.
4. RF-04 — Seguimiento de órdenes de trabajo.
5. RF-05 — Central de Repuestos.
6. RF-06 — Consulta de historial y generación de informes.

Autenticación, autorización, cierre de sesión, gestión mínima de cuentas y protección de rutas son capacidades transversales. No constituyen un séptimo RF.

---

## 3. Clases principales del dominio

Las clases principales del diagrama oficial son:

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

Las tablas técnicas permitidas solo pueden complementar trazabilidad o integridad. No son nuevos módulos ni nuevos RF.

---

## 4. Entidades/clases nucleares

### Rol

Atributos conceptuales:

- `idRol`
- `nombre`
- `descripcion`

Relaciones:

- Un Rol puede relacionarse con cero o muchos Usuarios.
- Cada Usuario tiene exactamente un Rol.

Regla:

- Solo existen los tres roles funcionales aprobados: Administrador, Mecánico y Conductor.

---

### Usuario

Atributos conceptuales:

- `idUsuario`
- `nombre`
- `email`
- `telefono`
- `contrasenaHash`
- `estado`

Relaciones:

- Pertenece exactamente a un Rol.
- Como Conductor puede tener muchas AsignacionConductor históricas.
- Como Conductor puede registrar muchas Novedades.
- Como Mecánico puede tener muchas OrdenTrabajo asignadas.
- Puede aparecer como responsable en operaciones auditadas según la regla de negocio.

Restricciones mínimas:

- Email único.
- Contraseña almacenada únicamente como hash.
- Estado activo/inactivo.

---

### Bus

Atributos conceptuales:

- `idBus`
- `codigoInterno`
- `placa`
- `marca`
- `modelo`
- `anio`
- `kilometrajeActual`
- `estadoOperativo`

Relaciones:

- Puede tener muchas AsignacionConductor históricas.
- Puede tener muchas Novedades.
- Puede tener muchas ProgramacionMantenimiento.
- Puede tener muchas OrdenTrabajo.

Restricciones:

- La identificación definida como única, placa y/o código interno según migración final, no admite duplicados.
- No debe eliminarse si eso destruye trazabilidad histórica.

---

### AsignacionConductor

Atributos conceptuales:

- `idAsignacion`
- `fechaInicio`
- `fechaFin`
- `activa`

Relaciones:

- Pertenece exactamente a un Usuario conductor.
- Pertenece exactamente a un Bus.
- Un Conductor puede tener muchas asignaciones históricas.
- Un Bus puede tener muchas asignaciones históricas.

Reglas aprobadas:

- Un conductor tiene máximo una asignación activa.
- Un bus tiene máximo una asignación activa.
- Cada reasignación cierra la anterior sin destruir el historial.
- El backend usa la asignación activa para limitar el acceso del conductor.

---

### Novedad

Atributos conceptuales:

- `idNovedad`
- `fecha`
- `tipo`
- `descripcion`
- `estado`

Relaciones:

- Pertenece exactamente al conductor autor.
- Pertenece exactamente a un Bus.
- Una Novedad puede generar cero o una OrdenTrabajo.

Reglas aprobadas:

- El autor se obtiene de la sesión.
- El bus se obtiene de la asignación activa.
- Si `origen = NOVEDAD`, la OrdenTrabajo debe relacionarse exactamente con una Novedad.
- Una novedad no puede producir órdenes duplicadas.

Estados aprobados:

- `PENDIENTE_REVISION`
- `RESUELTA_SIN_ORDEN`
- `DESCARTADA`
- `CONVERTIDA_A_ORDEN`

---

### ProgramacionMantenimiento

Atributos conceptuales:

- `idProgramacion`
- `tipo`
- `actividad`
- `fechaProgramada`
- `kilometrajeObjetivo`
- `estado`

Relaciones:

- Pertenece exactamente a un Bus.
- Puede generar cero o muchas OrdenTrabajo preventivas históricas.
- Cada OrdenTrabajo preventiva pertenece exactamente a una ProgramacionMantenimiento.

Reglas aprobadas:

- El criterio puede ser fecha, kilometraje o ambos.
- Los estados `VIGENTE`, `PROXIMO` y `VENCIDO` se calculan; no deben quedar desactualizados en una columna persistida.
- Solo puede existir una orden activa simultáneamente por programación.
- Al generar una orden preventiva se conserva una copia de la fecha y/o kilometraje objetivo que la originó.
- Al cerrar una orden preventiva se registra el siguiente objetivo si la programación continúa activa.

Esta interpretación de varias órdenes históricas con máximo una activa reemplaza cualquier lectura visual de máximo una orden total.

Implementacion RF-03:

- `estado` no existe como columna fisica de `programaciones_mantenimiento`; el DTO devuelve `clasificacion`.
- `kilometrajeActual` se toma de `Bus.kilometrajeActual`.
- `fechaProgramada` se almacena como `date` y se compara como dia calendario en la zona operacional `America/Bogota`.
- La generacion de orden preventiva conserva el mismo bus mediante FK compuesta y copia los objetivos preventivos aplicables.
- RF-03 crea la orden en `PENDIENTE_ASIGNACION`; asignacion, ejecucion y cierre quedan para RF-04.

---

### OrdenTrabajo

Atributos conceptuales:

- `idOrden`
- `tipo`
- `origen`
- `prioridad`
- `descripcion`
- `fechaCreacion`
- `estado`
- `costoTotal`

Relaciones:

- Pertenece exactamente a un Bus.
- Puede no tener Novedad porque también puede ser preventiva o correctiva directa.
- Puede pertenecer a una ProgramacionMantenimiento cuando es preventiva.
- Puede estar inicialmente sin técnico.
- Desde `ASIGNADA` debe tener exactamente un técnico.
- Contiene cero o muchas Intervencion.
- Puede tener cero o muchos ConsumoRepuesto.

Reglas aprobadas:

- Las órdenes cerradas e intervenciones alimentan el historial del bus.
- La asignación y reasignación de técnico son responsabilidad del Administrador.
- La reasignación debe quedar auditada.
- `CERRADA` es terminal.
- Solo el Administrador cierra órdenes.
- Solo el Mecánico marca la ejecución como completada.

Estados aprobados:

- `PENDIENTE_ASIGNACION`
- `ASIGNADA`
- `EN_EJECUCION`
- `COMPLETADA_TECNICO`
- `DEVUELTA_CORRECCION`
- `CERRADA`

---

### Intervencion

Atributos conceptuales:

- `idIntervencion`
- `fechaInicio`
- `fechaFin`
- `diagnostico`
- `actividadesRealizadas`
- `observaciones`

Relaciones:

- Pertenece exactamente a una OrdenTrabajo.
- Identifica exactamente al Mecánico responsable.
- Contiene cero o muchas ActividadOrden.

Reglas aprobadas:

- Una nueva intervención puede registrar el trabajo de corrección si la orden es devuelta.
- Para marcar una orden como `COMPLETADA_TECNICO` debe existir como mínimo una actividad registrada.
- En órdenes correctivas el diagnóstico es obligatorio.

---

### ActividadOrden

Atributos conceptuales:

- `idActividad`
- `descripcion`
- `fechaRegistro`

Relaciones:

- Pertenece exactamente a una Intervencion.

Regla:

- La actividad es el registro estructurado que soporta la validación mínima de ejecución técnica.

---

### Repuesto

Atributos conceptuales:

- `idRepuesto`
- `codigo`
- `nombre`
- `categoria`
- `unidadMedida`
- `stockActual`
- `stockMinimo`
- `costoUnitario`
- `estado`

Relaciones:

- Puede aparecer en muchos ConsumoRepuesto.
- Puede tener muchos MovimientoInventario.

Restricciones mínimas:

- Código único.
- Cantidades válidas.
- Costo no negativo.
- Estado activo/inactivo.

---

### ConsumoRepuesto

Atributos conceptuales:

- `idConsumo`
- `cantidad`
- `costoUnitario`
- `subtotal`

Relaciones oficiales:

- Pertenece exactamente a una OrdenTrabajo.
- Corresponde exactamente a un Repuesto.
- Genera exactamente un MovimientoInventario de tipo consumo.

Reglas aprobadas:

- La relación correcta es `OrdenTrabajo → ConsumoRepuesto → Repuesto`.
- No implementar una relación directa OrdenTrabajo-Repuesto que ignore ConsumoRepuesto.
- El consumo de repuestos es opcional.
- Consumo, movimiento y descuento de stock se ejecutan en una sola transacción.
- El costo unitario usado en el consumo conserva el valor histórico del momento.

---

### MovimientoInventario

Atributos conceptuales:

- `idMovimiento`
- `tipo`
- `cantidad`
- `motivo`
- `fecha`

Relaciones:

- Pertenece exactamente a un Repuesto.
- Identifica exactamente al Usuario responsable.
- Puede relacionarse con un ConsumoRepuesto cuando el movimiento es de tipo consumo.

Reglas aprobadas:

- Los movimientos incluyen entradas, consumos y ajustes.
- Administrador registra entradas y ajustes.
- Mecánico registra únicamente consumos autorizados.
- Un MovimientoInventario de entrada o ajuste no necesita ConsumoRepuesto.
- "Técnico asignado" corresponde a Usuario-OrdenTrabajo.
- "Responsable del movimiento" corresponde a Usuario-MovimientoInventario.
- No interpretar esas dos responsabilidades como una relación directa OrdenTrabajo-MovimientoInventario.

---

### Informe

El diagrama contempla `Informe`, pero la interpretación oficial es:

- Servicio.
- Consulta.
- DTO.
- Vista de reporte.

No crear inicialmente una tabla `Informe`.

Informe consulta información existente de buses, novedades, programaciones, órdenes, intervenciones, actividades, consumos, repuestos y movimientos.

AsignacionConductor no "genera" informes; sus datos únicamente pueden ser consultados como parte de un reporte.

La generación de informes nunca modifica datos históricos.

---

## 5. Tablas técnicas permitidas

La persistencia puede añadir tablas técnicas estrictamente justificadas para trazabilidad. Las autorizadas conceptualmente son:

- `LecturaKilometraje`.
- `OrdenEstadoHistorial`.
- `OrdenReasignacion`.
- `BusEstadoHistorial`, si se utiliza para auditar estados del bus.

Estas tablas no son nuevos módulos ni nuevos RF. Deben relacionarse con las clases principales y conservar responsable y fecha.

---

## 6. Relaciones principales

Representación conceptual oficial:

```text
Rol 1 -> 0..* Usuario

Usuario(Conductor) 1 -> 0..* AsignacionConductor
Bus                 1 -> 0..* AsignacionConductor

Usuario(Conductor) 1 -> 0..* Novedad
Bus                 1 -> 0..* Novedad
Novedad             1 -> 0..1 OrdenTrabajo

Bus                         1 -> 0..* ProgramacionMantenimiento
ProgramacionMantenimiento   1 -> 0..* OrdenTrabajo preventivas históricas
ProgramacionMantenimiento   1 -> 0..1 OrdenTrabajo preventiva activa

Bus                 1 -> 0..* OrdenTrabajo
Usuario(Mecánico)   1 -> 0..* OrdenTrabajo asignadas

OrdenTrabajo        1 -> 0..* Intervencion
Intervencion        1 -> 0..* ActividadOrden

OrdenTrabajo        1 -> 0..* ConsumoRepuesto
ConsumoRepuesto     * -> 1 Repuesto
Repuesto            1 -> 0..* MovimientoInventario
ConsumoRepuesto     1 -> 1 MovimientoInventario de consumo

Usuario             1 -> 0..* MovimientoInventario como responsable
```

---

## 7. Historial del bus

No crear una tabla editable llamada "historial" para duplicar datos.

El historial debe componerse desde datos reales y validados:

- Bus.
- AsignacionConductor cuando aporte contexto.
- LecturaKilometraje si se implementa.
- Novedad.
- ProgramacionMantenimiento.
- OrdenTrabajo.
- Intervencion.
- ActividadOrden.
- ConsumoRepuesto.
- Repuesto.
- MovimientoInventario.

Los informes consultan estos datos; no los modifican.

---

## 8. Integridad mínima

PostgreSQL debe usar:

- PK.
- FK.
- NOT NULL donde corresponda.
- UNIQUE.
- CHECK para cantidades, estados y coherencia cuando aporte seguridad.
- Índices únicos parciales cuando se necesiten reglas como "máximo una activa".
- Transacciones para operaciones múltiples.

Integridad aprobada adicional:

- Una asignación activa por conductor.
- Una asignación activa por bus.
- Una orden preventiva activa por programación.
- Una orden por novedad.
- Estados controlados para novedades y órdenes.
- Estados preventivos calculados, no persistidos como verdad durable.
- Auditoría de cambios de estado de orden.
- Auditoría de reasignación de técnico.
- Movimiento de inventario responsable y trazable.

Operación crítica de consumo:

1. Validar orden.
2. Validar permisos.
3. Validar repuesto y existencia.
4. Crear ConsumoRepuesto.
5. Crear MovimientoInventario de tipo consumo.
6. Descontar stock.
7. Confirmar transacción.

Ante fallo, rollback completo.

---

## 9. Migraciones

Persistencia fue autorizada e implementada el 2026-08-26. La migracion inicial no debe modificarse retroactivamente.

Toda modificacion futura de esquema debe:

1. Estar versionada.
2. Ser reproducible.
3. Actualizar este documento si cambia el modelo.
4. Mantener la alineación con los diagramas y decisiones oficiales.
5. Crear una migracion nueva, aditiva/correctiva cuando aplique, sin borrar historial aplicado.

---

## 10. Estado de implementacion de Persistencia

El bloque de Persistencia fue autorizado e implementado el 2026-08-26.

Artefactos tecnicos:

- `src/backend/prisma/schema.prisma`
- `src/backend/prisma/migrations/20260826140227_inicial_persistencia/migration.sql`
- `src/backend/prisma/migrations/20260826154500_auditoria_integridad_db/migration.sql`
- `src/backend/prisma/migrations/20260826163500_fija_search_path_triggers/migration.sql`
- `src/backend/prisma/seed.ts`
- `src/backend/test/prisma-integrity.test.ts`
- `docs/DATABASE_STRUCTURE.md`
- `docs/DATA_DICTIONARY.md`
- `docs/diagrams/modelo-relacional-fisico.drawio`
- `docs/diagrams/modelo-relacional-fisico.png`

Tablas persistentes creadas:

- `roles`
- `usuarios`
- `buses`
- `asignaciones_conductor`
- `novedades`
- `programaciones_mantenimiento`
- `ordenes_trabajo`
- `intervenciones`
- `actividades_orden`
- `repuestos`
- `consumos_repuesto`
- `movimientos_inventario`

Tablas tecnicas creadas:

- `lecturas_kilometraje`
- `bus_estado_historial`
- `orden_estado_historial`
- `orden_reasignaciones`

Restricciones clave implementadas:

- Una asignacion activa por conductor.
- Una asignacion activa por bus.
- Una orden por novedad.
- Varias ordenes preventivas historicas por programacion, con maximo una activa por programacion.
- Coherencia de origen/tipo en ordenes.
- Ordenes desde `ASIGNADA` con tecnico obligatorio.
- Ordenes `CERRADA` con responsable y fecha de cierre.
- Cantidades, costos y kilometrajes con valores validos.
- Movimiento tipo `CONSUMO` ligado a `ConsumoRepuesto`.
- Coherencia bus-orden para novedades y programaciones preventivas mediante FKs compuestas.
- Coherencia repuesto-consumo-movimiento mediante FK compuesta.
- Cada `ConsumoRepuesto` con exactamente un `MovimientoInventario` tipo `CONSUMO`.
- `subtotal` validado por PostgreSQL y `costoTotal` derivado por triggers.
- Fechas de orden cronologicas y `CERRADA` terminal.
- Email, placa y codigos normalizados para evitar duplicados por mayusculas/minusculas.

Diferencias tecnicas frente al diagrama conceptual:

- Los identificadores se implementan como UUID.
- Fechas operativas usan `timestamptz`; fechas objetivo preventivas usan `date`.
- Cantidades y costos usan `Decimal`.
- `VIGENTE`, `PROXIMO` y `VENCIDO` no se guardan como columna persistida.
- `Informe` no se creo como tabla.
- No existe relacion directa `OrdenTrabajo`-`Repuesto`; se consulta por `OrdenTrabajo -> ConsumoRepuesto -> Repuesto`.
- No existe relacion directa `OrdenTrabajo`-`MovimientoInventario`; se consulta por `MovimientoInventario -> ConsumoRepuesto -> OrdenTrabajo` cuando el movimiento es consumo.
- Las reglas que Prisma no expresa de forma declarativa se implementan con SQL PostgreSQL en migraciones versionadas: indices parciales, checks, FKs compuestas y triggers.
- Las funciones de triggers fijan `search_path` para que las validaciones desde schemas temporales de Neon sean reproducibles.

---

## 11. Datos semilla

Los datos semilla pertenecen al bloque de implementacion de Persistencia y ya estan implementados en `src/backend/prisma/seed.ts`.

Incluyen datos de desarrollo/prueba para los tres roles sin presentar personas reales ni contraseñas reales. El seed exige `SEED_USER_PASSWORD` en entorno local o variable de proceso; no existe contraseña demo predeterminada en codigo.
