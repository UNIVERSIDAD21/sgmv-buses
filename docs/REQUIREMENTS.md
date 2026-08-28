# Requerimientos finales para implementación

## 1. Regla de versión

Este archivo contiene la **línea base funcional vigente para Fase 3**.

Versiones anteriores que incluían 24, 52 o cualquier otra cantidad de RF quedan como antecedentes analíticos y no deben usarse como lista de implementación.

La versión vigente mantiene exactamente:

- **6 RF principales**
- **4 RNF consolidados**

---

# 2. Requerimientos funcionales

## RF-01 — Gestión de la flota vehicular

### Requerimiento

El sistema permitirá registrar, consultar y actualizar buses de la flota, incluyendo sus datos de identificación, estado operativo, kilometraje y asignación de conductor. El Conductor solo podrá consultar la información autorizada del bus que tenga asignado.

### Actores

- Administrador
- Conductor, con acceso limitado

### Funciones incluidas

Administrador:

- Registrar bus.
- Consultar buses.
- Actualizar datos.
- Actualizar kilometraje.
- Cambiar estado operativo.
- Gestionar asignación de conductor.
- Conservar historial de asignaciones/datos relevantes.

Conductor:

- Consultar únicamente su bus asignado.
- Consultar información básica permitida.
- Consultar estado operativo.
- Consultar próximo mantenimiento cuando esté disponible.

### Criterios de aceptación

- Placa y/o código interno definidos como únicos no admiten duplicados.
- Los datos se persisten correctamente.
- La asignación de conductor queda trazada.
- El conductor no puede consultar información de otro bus mediante interfaz ni mediante llamada directa a la API.
- Los cambios necesarios para trazabilidad no destruyen historial.

---

## RF-02 — Control de novedades operativas

### Requerimiento

El sistema permitirá al Conductor registrar fallas o novedades asociadas a su bus y consultar su seguimiento. El Administrador podrá revisarlas, clasificarlas, resolverlas/descartarlas o convertirlas en una orden de trabajo correctiva.

### Actores

- Conductor
- Administrador

### Datos mínimos del reporte

- Conductor autor, obtenido de la sesión.
- Bus, obtenido de la asignación válida.
- Fecha/hora, generada por el sistema.
- Tipo de novedad.
- Descripción.
- Estado.

### Criterios de aceptación

- El conductor no puede reportar una novedad para un bus ajeno.
- El conductor solo consulta sus reportes.
- El Administrador puede gestionar la novedad.
- Si una novedad origina una orden, ambos registros permanecen relacionados.
- El estado consultado por el conductor refleja el seguimiento real.
- No se exponen datos administrativos que el conductor no necesita.

---

## RF-03 — Administración del mantenimiento preventivo

### Requerimiento

El sistema permitirá al Administrador programar mantenimiento preventivo por fecha, kilometraje o ambos, consultar las programaciones e identificar mantenimientos vigentes, próximos o vencidos. Una programación podrá originar una orden preventiva manteniendo la trazabilidad entre ambos registros.

### Actores

- Administrador
- Sistema

### Funciones incluidas

- Crear programación.
- Consultar programaciones.
- Actualizar/reprogramar mientras la regla de negocio lo permita.
- Evaluar fecha/kilometraje.
- Identificar estado de seguimiento.
- Generar orden preventiva.
- Conservar relación programación → orden.

### Criterios de aceptación

- Toda programación identifica como mínimo bus, actividad y criterio.
- El criterio puede ser fecha, kilometraje o ambos.
- El sistema diferencia condiciones no vencidas y vencidas.
- La regla de "próximo" utiliza un umbral documentado/configurable; no debe ocultarse en código sin documentación.
- Una orden generada desde una programación conserva su origen.
- No se generan duplicados accidentales de orden para la misma programación.

### Implementacion RF-03

- Contrato real documentado en `docs/RF03_MANTENIMIENTO_PREVENTIVO.md`.
- Rutas finales bajo `/mantenimiento-preventivo`.
- Clasificacion calculada en backend con umbrales `PREVENTIVE_SOON_DAYS=7` y `PREVENTIVE_SOON_KM=500`.
- Conductor y Mecanico no administran RF-03 y reciben acceso denegado.
- La orden preventiva se genera inicialmente en `PENDIENTE_ASIGNACION`, sin Mecanico asignado; asignacion, ejecucion y cierre quedan para RF-04.

---

## RF-04 — Seguimiento de órdenes de trabajo

### Requerimiento

El sistema permite gestionar ordenes de trabajo preventivas y correctivas desde su recepcion o creacion autorizada hasta su cierre administrativo, conservando trazabilidad de estados, asignaciones, intervenciones, actividades, consumos, stock y costo basico.

### Estado implementado

Contrato real documentado en `docs/RF04_ORDENES_TRABAJO.md`.

### Actores

- Administrador
- Mecanico
- Sistema

Conductor no participa en RF-04 interno y recibe acceso denegado.

### Origenes admitidos

- `PREVENTIVO`: generado desde RF-03 con programacion y bus conservados.
- `NOVEDAD`: generado desde RF-02 con novedad y bus conservados.
- `CORRECTIVO_DIRECTO`: orden correctiva manual creada por Administrador en RF-04.

No existe origen fisico `MANUAL`. La orden preventiva manual no se implementa porque no hay campos de intervalo preventivo aprobados fuera de `programaciones_mantenimiento`.

### Funciones del Administrador

- Consultar resumen, listado, detalle, historial y reasignaciones.
- Crear orden correctiva directa.
- Asignar mecanico.
- Reasignar mecanico con motivo y trazabilidad.
- Consultar informacion tecnica, consumos y costo basico.
- Devolver una orden completada para correccion.
- Cerrar administrativamente con confirmacion.

### Funciones del Mecanico

- Consultar solo ordenes asignadas vigentes.
- Iniciar y reanudar ordenes propias.
- Registrar diagnostico, observaciones y actividades.
- Consultar repuestos activos y existencia disponible.
- Registrar consumos con descuento transaccional.
- Marcar completado tecnico.

### Criterios de aceptacion

- Toda orden identifica bus, tipo, origen, estado, creador y tecnico cuando el estado lo exige.
- La maquina valida `PENDIENTE_ASIGNACION -> ASIGNADA -> EN_EJECUCION -> COMPLETADA_TECNICO -> CERRADA` y el ciclo `COMPLETADA_TECNICO -> DEVUELTA_CORRECCION -> EN_EJECUCION`.
- Toda transicion real crea historial de estado.
- Las reasignaciones conservan tecnico anterior, tecnico nuevo, Administrador, motivo y fecha.
- El consumo genera exactamente un movimiento `CONSUMO`, descuenta stock en la misma transaccion y usa costo del servidor.
- `CERRADA` es terminal.
- RF-05 no se inicia: no hay compras, entradas, ajustes ni catalogo completo.
- RF-06 no se inicia: no hay informes consolidados ni exportaciones.

---

## RF-05 — Central de Repuestos

### Requerimiento

El sistema permitirá administrar el catálogo y las existencias de repuestos e insumos, registrar entradas y ajustes, consultar disponibilidad y asociar los consumos de una intervención con la orden correspondiente.

### Actores

- Administrador
- Mecánico
- Sistema

### Administrador

- Registrar repuesto/insumo.
- Actualizar información.
- Activar/desactivar.
- Registrar entradas.
- Registrar ajustes.
- Consultar existencias.
- Consultar movimientos.

### Mecánico

- Consultar existencias.
- Registrar consumo durante una intervención/orden.
- No realizar ajustes administrativos de inventario.

### Criterios de aceptación

- Cada movimiento registra tipo, cantidad, motivo cuando aplique, fecha y responsable.
- Cada consumo identifica orden y repuesto.
- El consumo actualiza stock de forma consistente.
- La operación de consumo y descuento de inventario es atómica.
- No debe existir un consumo huérfano sin orden/repuesto.
- El sistema evita cantidades inválidas y stock inconsistente.
- Los movimientos quedan disponibles para auditoría y reportes.

---

## RF-06 — Consulta de historial y generación de informes

### Requerimiento

El sistema permitirá consultar el historial de mantenimiento de acuerdo con los permisos de cada rol y permitirá al Administrador generar informes filtrables relacionados con flota, mantenimiento, órdenes de trabajo, repuestos, historial y costos básicos.

### Actores

- Administrador
- Mecánico
- Conductor, limitado

### Acceso

Administrador:

- Historial completo permitido.
- Informes.
- Costos básicos.
- Filtros.

Mecánico:

- Historial técnico necesario para su trabajo.
- Sin funciones administrativas no autorizadas.

Conductor:

- Resumen básico y solo de su bus asignado.
- Sin costos.
- Sin inventario administrativo.
- Sin información de otros buses.

### Filtros mínimos de informes

- Bus.
- Período.
- Tipo de intervención.

Pueden agregarse filtros derivados de los datos existentes siempre que no creen nuevo alcance de negocio.

### Criterios de aceptación

- El historial mostrado proviene de datos reales almacenados en órdenes/intervenciones relacionadas.
- Los filtros producen resultados coherentes con la base de datos.
- El conductor no puede saltarse las restricciones mediante API.
- Los costos básicos provienen de información trazable del mantenimiento.
- No se implementa analítica predictiva.

---

# 3. Capacidades transversales obligatorias

Estas capacidades se implementan, pero **no cuentan como RF principales**:

- Iniciar sesión.
- Cerrar sesión.
- Hash seguro de contraseña.
- Protección de rutas.
- Autorización por roles.
- Rechazo de cuentas inactivas.
- Gestión mínima de cuentas por Administrador.
- Validación de entradas.
- Manejo controlado de errores.
- Auditoría básica.
- Búsquedas/filtros operativos necesarios dentro de los RF.

---

# 4. Requerimientos no funcionales

## RNF-01 — Seguridad de la información

El sistema deberá proteger la información mediante almacenamiento seguro de contraseñas, control de acceso por roles en interfaz y backend, validación de entradas, integridad referencial y registro de operaciones relevantes.

### Aceptación

- Contraseñas nunca en texto plano.
- Operaciones no autorizadas rechazadas en backend.
- Datos inválidos rechazados.
- Sin referencias huérfanas.
- Acciones críticas permiten identificar responsable y fecha.
- Secretos fuera del código fuente.

**Prioridad:** Alta.

---

## RNF-02 — Usabilidad de la aplicación

La aplicación deberá mantener navegación clara, terminología consistente y una interfaz adaptable a los tamaños de pantalla previstos, permitiendo completar los flujos principales en navegadores web modernos.

### Aceptación

- Navegación consistente.
- Sin recorridos innecesarios para tareas frecuentes.
- Vistas principales responsive.
- Flujos críticos validados al menos en Chrome y Edge actuales durante las pruebas.

**Prioridad:** Media.

---

## RNF-03 — Desempeño del sistema

El prototipo deberá responder en tiempos adecuados durante las operaciones habituales y permanecer accesible en el entorno de despliegue utilizado durante las jornadas de prueba.

### Aceptación

Bajo las condiciones de prueba del proyecto:

- al menos 95 % de las operaciones habituales responde en un máximo aproximado de 3 segundos;
- frontend, API y base de datos permanecen accesibles durante la validación.

Esto es un criterio de prototipo académico, no un SLA empresarial.

**Prioridad:** Media.

---

## RNF-04 — Mantenibilidad del software

El sistema deberá implementarse con estructura modular que separe interfaz, lógica de negocio y acceso a datos, manteniendo configuraciones y credenciales sensibles fuera del código fuente.

### Aceptación

- Frontend, backend y datos tienen responsabilidades separadas.
- Los módulos principales son identificables.
- No concentrar toda la lógica en archivos monolíticos.
- Configuración por variables de entorno.
- Código entendible y mantenible.

**Prioridad:** Media.
