# RF-06 — Consulta de historial y generación de informes

## Objetivo

RF-06 ofrece una lectura cronológica y trazable del mantenimiento vehicular, derivada de los datos validados por RF-01 a RF-05. No crea un historial paralelo ni persiste informes.

## Alcance por rol

### Administrador

- Consulta todos los buses y su historial permitido.
- Filtra por bus, período, tipo, estado y origen de orden.
- Consulta asignaciones, cambios de estado, kilometrajes, novedades, programaciones, órdenes, intervenciones, actividades y consumos.
- Consulta costos históricos básicos.
- Genera vistas de informe de mantenimiento, repuestos utilizados y costos por bus.

### Mecánico

- Solo consulta buses donde es técnico asignado actual/histórico o responsable de una intervención.
- Ve órdenes autorizadas, diagnósticos, actividades y repuestos técnicos consumidos.
- No recibe costos, asignaciones de conductores, novedades personales ni informes administrativos.

### Conductor

- Consulta únicamente el bus de su asignación activa mediante `/historial/mi-bus`.
- El backend deriva el bus desde la sesión; no se acepta `busId` para esta vista.
- Ve datos básicos del bus, programación de mantenimiento, estado de órdenes y novedades propias.
- No recibe costos, inventario administrativo, diagnósticos internos, repuestos ni datos de otros conductores o buses.

## Endpoints

Todos requieren sesión autenticada y son de solo lectura.

| Método | Ruta | Roles | Propósito |
| --- | --- | --- | --- |
| `GET` | `/historial/resumen` | Todos | Indicadores limitados al alcance del rol. |
| `GET` | `/historial/buses` | Administrador, Mecánico | Lista paginada de buses con historial autorizado. |
| `GET` | `/historial/buses/:busId` | Administrador, Mecánico | Detalle cronológico con autorización en backend. |
| `GET` | `/historial/mi-bus` | Conductor | Historial del bus derivado de la asignación activa. |
| `GET` | `/historial/informes/mantenimiento` | Administrador | Órdenes e indicadores de mantenimiento. |
| `GET` | `/historial/informes/repuestos` | Administrador | Consumos agrupados por repuesto. |
| `GET` | `/historial/informes/costos` | Administrador | Costos de órdenes agrupados por bus. |

## Filtros

- `busId`: UUID de bus, solo donde el endpoint y rol lo permiten.
- `fechaDesde` y `fechaHasta`: fechas ISO `YYYY-MM-DD`; el inicio no puede superar el fin.
- `tipo`: `PREVENTIVA` o `CORRECTIVA`.
- `estado`: estado canónico de orden RF-04.
- `origen`: `PREVENTIVO`, `NOVEDAD` o `CORRECTIVO_DIRECTO`.
- `busqueda`: código interno, placa, marca o modelo en el listado de buses.
- `pagina`/`limite`; también se aceptan `page`/`pageSize` para compatibilidad de consulta.

Los filtros enviados por el cliente se combinan de forma acumulativa con el alcance del rol. Nunca reemplazan la restricción de seguridad.

El resumen usa el mismo universo filtrado que el listado de buses. La búsqueda por código, placa, marca o modelo también restringe órdenes, costos e informes; el período se aplica a la fecha de creación de órdenes, la fecha de reporte de novedades y la fecha programada de mantenimientos. Los filtros de orden limitan primero los buses relacionados antes de calcular los demás indicadores.

## Fuentes de datos

El historial se construye con:

- `buses`, `bus_estado_historial` y `lecturas_kilometraje`;
- `asignaciones_conductor`;
- `novedades`;
- `programaciones_mantenimiento`;
- `ordenes_trabajo`, `orden_estado_historial` y `orden_reasignaciones`;
- `intervenciones` y `actividades_orden`;
- `consumos_repuesto` y `repuestos`.

Los informes de costos usan `ordenes_trabajo.costo_total` y los valores históricos fotografiados en `consumos_repuesto`. No aceptan costos calculados por el navegador.

## Persistencia

RF-06 no modifica `schema.prisma`, no agrega migraciones y no crea tabla `Informe`. `Informe` se materializa únicamente como servicio, consulta y DTO de respuesta.

## Interfaz

La ruta `/historial` reemplaza el estado pendiente y ofrece:

- encabezado de solo lectura y alcance visible por rol;
- indicadores resumidos;
- filtros accesibles para Administrador y Mecánico;
- tarjetas de bus y detalle cronológico;
- informes administrativos separados;
- vista directa del bus asignado para Conductor;
- estados de carga, error y ausencia de asignación.

## Pruebas

- Backend: `src/backend/test/report.test.ts`.
- Frontend: escenarios RF-06 en `src/frontend/src/App.test.tsx`.
- Validaciones globales: Prisma, typecheck, lint, pruebas de frontend/backend, build y `git diff --check`.
- Resultado RF-06: backend `5/5` y frontend `4/4`.
- Regresión completa: backend `85/85` en 9 archivos y frontend `46/46`.

## Evidencia visual

- `docs/screenshots/rf06-admin-overview-1440x900.png`
- `docs/screenshots/rf06-admin-filters-1024x768.png`
- `docs/screenshots/rf06-admin-detail-1440x900.png`
- `docs/screenshots/rf06-mechanic-1440x900.png`
- `docs/screenshots/rf06-driver-1440x900.png`
- `docs/screenshots/rf06-mobile-390x844.png`

La revisión visual del 2026-09-01 confirmó los tres alcances por rol, filtros y detalle, ausencia de datos restringidos en Mecánico/Conductor, consola sin errores relevantes y diseño sin desbordamiento horizontal en `1440x900`, `1024x768` y `390x844`.

## Límites explícitos

- Sin analítica predictiva.
- Sin exportaciones ni generación de archivos contables.
- Sin compras, proveedores o inventario paralelo.
- Sin nuevas escrituras, tablas o RF.
- Sin ampliación de permisos de RF-01 a RF-05.
