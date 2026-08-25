# Modelo de datos para Fase 3

## 1. Propósito

Este documento traduce el diseño de clases aprobado a una guía de persistencia para PostgreSQL/Neon.

No pretende reemplazar el diagrama de clases. Si el diagrama aprobado cambia, actualizar este documento antes de migrar el esquema afectado.

---

## 2. Entidades/clases nucleares

### Rol

Atributos conceptuales:

- `idRol`
- `nombre`
- `descripcion`

Relación:

- Un Rol puede estar asociado a múltiples Usuarios.
- Cada Usuario utiliza el rol necesario para control de acceso según el diseño vigente.

Roles funcionales esperados:

- ADMIN_SUPERVISOR
- MECANICO
- CONDUCTOR_OPERADOR

Los nombres técnicos pueden variar, pero el significado no.

---

### Usuario

Atributos conceptuales:

- `idUsuario`
- `nombre`
- `email`
- `telefono`
- `contrasenaHash`
- `estado`

Debe incluir relación con Rol.

Restricciones mínimas:

- email único;
- contraseña solo como hash;
- estado activo/inactivo.

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

Restricciones de identificación única según migración final.

---

### AsignacionConductor

Atributos conceptuales:

- `idAsignacion`
- `fechaInicio`
- `fechaFin`
- `activa`

Relaciones:

- pertenece a un Usuario con rol Conductor/Operador;
- pertenece a un Bus;
- conserva historial.

El backend usa la asignación activa para limitar el acceso del conductor.

Reglas aprobadas de integridad:

- maximo una asignacion activa por conductor;
- maximo una asignacion activa por bus;
- reasignacion transaccional que cierre la asignacion anterior con `fechaFin` y `activa=false`;
- conservar historial de asignaciones.

---

### Novedad

Atributos conceptuales:

- `idNovedad`
- `fecha`
- `tipo`
- `descripcion`
- `estado`

Relaciones:

- pertenece al Conductor/Operador que reporta;
- pertenece al Bus;
- puede originar 0..1 OrdenTrabajo.

Estados aprobados:

- `PENDIENTE_REVISION`
- `RESUELTA_SIN_ORDEN`
- `DESCARTADA`
- `CONVERTIDA_A_ORDEN`

La clasificacion de la novedad se maneja como dato separado del estado cuando aplique.

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

- pertenece a un Bus;
- puede originar 0..1 OrdenTrabajo.

Según criterio, fecha o kilometraje pueden ser opcionales individualmente, pero no deben quedar ambos ausentes en una programación válida.

Estados calculados/aprobados:

- `VIGENTE`
- `PROXIMO`
- `VENCIDO`

Umbrales aprobados:

- 7 dias calendario para proximidad por fecha.
- 500 km para proximidad por kilometraje.

No puede existir mas de una orden activa para la misma programacion preventiva. Al cerrar una orden preventiva deben actualizarse la proxima fecha o el proximo kilometraje objetivo antes de permitir nueva generacion.

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

Relaciones necesarias:

- pertenece a un Bus;
- puede estar vinculada a Novedad;
- puede estar vinculada a ProgramacionMantenimiento;
- tiene técnico responsable cuando está asignada;
- compone/posee 0..* Intervenciones;
- compone/posee 0..* ConsumosRepuesto.

Se recomienda representar los vínculos de origen mediante FKs opcionales y restricciones coherentes, no mediante texto sin trazabilidad.

Estados aprobados:

- `PENDIENTE_ASIGNACION`
- `ASIGNADA`
- `EN_EJECUCION`
- `COMPLETADA_TECNICO`
- `DEVUELTA_CORRECCION`
- `CERRADA`

`CERRADA` es terminal. No se permite cerrar desde `ASIGNADA` ni desde `EN_EJECUCION`.

La reasignacion de mecanico debe quedar auditada con responsable y fecha.

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

- pertenece a OrdenTrabajo;
- debe permitir identificar al técnico responsable, directamente o por la relación de la orden.

Para permitir marcar una orden como `COMPLETADA_TECNICO`, deben existir fechas de ejecucion y actividades realizadas. En ordenes correctivas, el diagnostico es obligatorio. El consumo de repuestos es opcional.

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

Restricciones mínimas:

- código único;
- cantidades válidas;
- costo no negativo;
- estado activo/inactivo.

---

### ConsumoRepuesto

Atributos conceptuales:

- `idConsumo`
- `cantidad`
- `costoUnitario`
- `subtotal`

Relaciones:

- pertenece a OrdenTrabajo;
- pertenece a Repuesto.

El subtotal se deriva de cantidad × costo unitario de la transacción.

El costo unitario utilizado en el consumo debe conservar el valor histórico de ese momento si el costo del catálogo cambia después.

El consumo de repuestos es opcional dentro de una orden; cuando exista, debe mantener relacion con la orden y el repuesto.

---

### MovimientoInventario

Atributos conceptuales:

- `idMovimiento`
- `tipo`
- `cantidad`
- `motivo`
- `fecha`

Relaciones:

- pertenece a Repuesto;
- identifica usuario responsable cuando aplique.

Tipos esperados conceptualmente:

- ENTRADA
- SALIDA/CONSUMO
- AJUSTE

La nomenclatura final se documenta en `DECISIONS.md`.

---

### Informe

El diagrama de clases contempla `Informe` con conceptos como:

- tipo;
- fechaInicio;
- fechaFin;
- fechaGeneracion;
- aplicar filtros;
- generar.

**No se requiere convertir Informe automáticamente en una tabla.**

Para el prototipo puede implementarse como:

- servicio;
- consulta;
- DTO/view model;
- endpoint de reporte.

Solo persistir informes si existe un requisito explícito de historial de informes generados.

---

## 3. Historial del bus

No crear una tabla editable llamada "historial" únicamente para duplicar datos.

El historial debe poder componerse mediante consultas sobre:

- Bus.
- OrdenTrabajo.
- Intervencion.
- ConsumoRepuesto.
- Novedad cuando aporte trazabilidad.
- ProgramacionMantenimiento cuando aporte contexto.

Puede utilizarse una vista SQL o una consulta de servicio si facilita el acceso.

---

## 4. Relaciones principales

Representación conceptual:

```text
Rol 1 ───── 0..* Usuario

Usuario(Conductor) 1 ───── 0..* AsignacionConductor
Bus                 1 ───── 0..* AsignacionConductor

Usuario(Conductor) 1 ───── 0..* Novedad
Bus                 1 ───── 0..* Novedad
Novedad             1 ───── 0..1 OrdenTrabajo

Bus                 1 ───── 0..* ProgramacionMantenimiento
Programacion        1 ───── 0..1 OrdenTrabajo

Bus                 1 ───── 0..* OrdenTrabajo
Usuario(Mecánico)   1 ───── 0..* OrdenTrabajo asignadas

OrdenTrabajo        1 ◆───── 0..* Intervencion
OrdenTrabajo        1 ◆───── 0..* ConsumoRepuesto

Repuesto            1 ───── 0..* ConsumoRepuesto
Repuesto            1 ───── 0..* MovimientoInventario
```

---

## 5. Metadatos transversales

RNF-01 exige trazabilidad básica.

Agregar cuando aplique:

- `created_at`
- `updated_at`
- `created_by`
- `updated_by`

No es obligatorio usar exactamente esos nombres, pero sí conservar el significado.

---

## 6. Integridad

PostgreSQL debe usar:

- PK.
- FK.
- NOT NULL donde corresponda.
- UNIQUE.
- CHECK para cantidades/estados cuando aporte seguridad.
- transacciones para operaciones múltiples.

Integridad aprobada adicional:

- indices unicos parciales o restriccion equivalente para una asignacion activa por conductor y por bus;
- restriccion/validacion para una sola orden activa por programacion preventiva;
- estados controlados para novedades, programaciones y ordenes;
- auditoria de reasignacion de mecanico.

### Operación crítica

Registrar consumo de repuesto:

1. validar orden;
2. validar permisos;
3. bloquear/leer existencia de forma segura;
4. validar cantidad;
5. crear consumo;
6. crear movimiento;
7. actualizar stock;
8. commit.

Ante fallo, rollback completo.

---

## 7. Migraciones

Nunca editar manualmente producción como mecanismo principal de evolución.

Toda modificación de esquema debe:

1. estar versionada;
2. ser reproducible;
3. actualizar este documento si cambia el modelo;
4. incluir rollback o estrategia clara de corrección cuando aplique.

---

## 8. Datos semilla

Crear datos de desarrollo/prueba que permitan probar los tres roles.

No presentar datos simulados como personas reales.

Como mínimo:

- 1 Administrador/Supervisor.
- 1 Mecánico.
- 1 Conductor/Operador.
- buses de prueba;
- repuestos de prueba;
- escenarios de novedad/preventivo/orden.

Nunca incluir contraseñas reales en el repositorio.
