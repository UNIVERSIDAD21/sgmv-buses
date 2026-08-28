# RF-04 - Seguimiento de ordenes de trabajo

## 1. Alcance implementado

RF-04 controla el ciclo operativo completo de una orden de trabajo correctiva o preventiva desde su recepcion en taller hasta el cierre administrativo. Reutiliza las ordenes creadas por RF-02 y RF-03, permite crear ordenes correctivas directas autorizadas, asigna y reasigna mecanicos con trazabilidad, registra ejecucion tecnica, actividades y consumos de repuestos, calcula costo basico disponible y bloquea modificaciones sobre ordenes cerradas.

No implementa RF-05 ni RF-06. El catalogo completo de repuestos, compras, entradas, ajustes administrativos, informes consolidados y exportaciones siguen pendientes para sus bloques propios.

## 2. Roles

- `ADMINISTRADOR`: consulta todas las ordenes, crea orden correctiva directa, asigna, reasigna, revisa, devuelve y cierra.
- `MECANICO`: consulta solo sus ordenes vigentes, inicia o reanuda ejecucion, registra diagnostico, observaciones, actividades, consumos y completa tecnicamente.
- `CONDUCTOR`: no participa en RF-04 interno; recibe acceso denegado a rutas y API.

Los alias heredados de roles siguen rechazados. Solo se aceptan `ADMINISTRADOR`, `MECANICO` y `CONDUCTOR`.

## 3. Endpoints

Todos los endpoints requieren sesion valida.

| Metodo | Ruta | Rol | Proposito |
|---|---|---|---|
| `GET` | `/ordenes-trabajo/resumen` | Administrador, Mecanico | Conteos reales por estado, tipo y origen. |
| `GET` | `/ordenes-trabajo` | Administrador | Lista paginada con busqueda, filtros y ordenamiento. |
| `POST` | `/ordenes-trabajo` | Administrador | Crea orden correctiva directa. |
| `GET` | `/ordenes-trabajo/mis-ordenes` | Mecanico | Lista paginada de ordenes asignadas al usuario. |
| `GET` | `/ordenes-trabajo/mecanicos-disponibles` | Administrador | Mecanicos activos disponibles para asignar. |
| `GET` | `/ordenes-trabajo/:ordenId` | Administrador, Mecanico asignado | Detalle seguro segun rol y propiedad. |
| `GET` | `/ordenes-trabajo/:ordenId/historial` | Administrador, Mecanico asignado | Historial de estados. |
| `GET` | `/ordenes-trabajo/:ordenId/reasignaciones` | Administrador, Mecanico asignado | Trazabilidad de reasignaciones. |
| `POST` | `/ordenes-trabajo/:ordenId/asignar` | Administrador | Asignacion inicial. |
| `POST` | `/ordenes-trabajo/:ordenId/reasignar` | Administrador | Reasignacion con motivo. |
| `POST` | `/ordenes-trabajo/:ordenId/iniciar` | Mecanico asignado | Pasa de `ASIGNADA` a `EN_EJECUCION` y crea intervencion. |
| `POST` | `/ordenes-trabajo/:ordenId/reanudar` | Mecanico asignado | Pasa de `DEVUELTA_CORRECCION` a `EN_EJECUCION` y crea nuevo segmento de intervencion. |
| `PATCH` | `/ordenes-trabajo/:ordenId/intervencion` | Mecanico asignado | Actualiza diagnostico y observaciones de la intervencion activa. |
| `POST` | `/ordenes-trabajo/:ordenId/actividades` | Mecanico asignado | Registra actividad trazable. |
| `GET` | `/ordenes-trabajo/:ordenId/repuestos-disponibles` | Mecanico asignado | Consulta minima de repuestos activos y stock. |
| `POST` | `/ordenes-trabajo/:ordenId/consumos` | Mecanico asignado | Registra consumo transaccional e idempotente. |
| `POST` | `/ordenes-trabajo/:ordenId/completar` | Mecanico asignado | Marca completado tecnico. |
| `POST` | `/ordenes-trabajo/:ordenId/devolver` | Administrador | Devuelve para correccion con motivo. |
| `POST` | `/ordenes-trabajo/:ordenId/cerrar` | Administrador | Cierra administrativamente con confirmacion. |

No existe un `PATCH` abierto para estado, tecnico, costos, relaciones protegidas ni auditoria.

## 4. Maquina de estados

La maquina vive centralizada en `src/backend/src/work-orders/work-order.state.ts`.

Flujo principal:

```text
PENDIENTE_ASIGNACION -> ASIGNADA -> EN_EJECUCION -> COMPLETADA_TECNICO -> CERRADA
```

Flujo de correccion:

```text
COMPLETADA_TECNICO -> DEVUELTA_CORRECCION -> EN_EJECUCION -> COMPLETADA_TECNICO
```

Reglas aplicadas:

- `PENDIENTE_ASIGNACION` permite tecnico nulo.
- Los estados posteriores requieren mecanico asignado.
- `CERRADA` exige `fechaCierre` y `cerradaPorId`.
- `CERRADA` es terminal y no acepta actividades, consumos, asignaciones, reasignaciones ni cambios de estado.
- Toda transicion real crea un registro en `orden_estado_historial`.
- Se rechazan saltos y acciones repetidas no idempotentes.

## 5. Origenes de orden

- RF-02 genera ordenes `tipo=CORRECTIVA`, `origen=NOVEDAD`, con la novedad y el mismo bus conservados.
- RF-03 genera ordenes `tipo=PREVENTIVA`, `origen=PREVENTIVO`, con la programacion, el mismo bus y los objetivos preventivos copiados.
- RF-04 crea manualmente solo ordenes correctivas directas `tipo=CORRECTIVA`, `origen=CORRECTIVO_DIRECTO`.

La orden preventiva manual no se implementa porque el modelo fisico aprobado no tiene origen `MANUAL` ni campos de intervalo preventivo independientes. Crear una preventiva manual sin programacion rompería la trazabilidad aprobada.

## 6. Asignacion y reasignacion

La asignacion inicial es exclusiva del Administrador y solo procede desde `PENDIENTE_ASIGNACION`. Valida que el usuario exista, este activo y tenga rol `MECANICO`; luego actualiza `tecnico_asignado_id`, marca `fecha_asignacion`, cambia a `ASIGNADA` y registra historial en una sola transaccion.

La reasignacion exige mecanico diferente y motivo. Se permite en `ASIGNADA`, `EN_EJECUCION` y `DEVUELTA_CORRECCION`; se rechaza en `CERRADA` y en `COMPLETADA_TECNICO`. Si ocurre durante `EN_EJECUCION`, se conserva el estado para no inventar estados intermedios: las intervenciones activas del mecanico anterior se cierran y se crea una nueva intervencion para el mecanico vigente. La operacion registra `orden_reasignaciones` y el mecanico anterior pierde escritura inmediatamente.

## 7. Intervenciones y actividades

El mecanico asignado puede registrar informacion tecnica solo con la orden en `EN_EJECUCION`. El inicio y la reanudacion crean una intervencion asociada a la orden y al mecanico actual. La reanudacion despues de devolucion conserva las intervenciones previas y abre un nuevo segmento trazable.

Validaciones:

- Diagnostico no vacio cuando se informa.
- Observaciones opcionales.
- Actividades no vacias.
- Al menos una actividad antes de `COMPLETADA_TECNICO`.
- Diagnostico obligatorio para ordenes correctivas antes de completar y cerrar.

## 8. Consumos, stock y costo basico

El consumo de repuestos queda dentro de RF-04 solo como operacion durante la ejecucion de una orden. No administra catalogo, compras, entradas ni ajustes.

La transaccion de consumo:

1. Bloquea la orden y el repuesto mediante candados advisory de transaccion.
2. Valida sesion, rol, propiedad, estado `EN_EJECUCION`, repuesto activo y stock suficiente.
3. Usa el costo unitario del servidor.
4. Crea `consumos_repuesto`.
5. Crea exactamente un `movimientos_inventario` tipo `CONSUMO`.
6. Descuenta `repuestos.stock_actual` con una actualizacion condicional que exige stock suficiente.
7. Deja `ordenes_trabajo.costo_total` coherente con los subtotales.

Se agrego `consumos_repuesto.clave_idempotencia` con indice unico parcial para proteger doble envio de formularios. La aritmetica monetaria usa `Decimal` de Prisma; el cliente no puede enviar costos ni subtotales. Las transiciones de estado tambien usan actualizaciones condicionales para rechazar solicitudes repetidas o simultaneas sin generar historial duplicado.

## 9. Cierre administrativo

El Administrador solo puede cerrar desde `COMPLETADA_TECNICO`. El cierre valida mecanico asociado, intervenciones, actividades, diagnostico correctivo, consistencia consumo/movimiento y costo basico. Luego fija `fecha_cierre`, `cerrada_por_id`, estado `CERRADA` e historial final dentro de una transaccion.

El historial tecnico del bus queda disponible a traves de orden, intervenciones, actividades, consumos y movimientos. RF-04 no cambia automaticamente el estado operativo del bus porque las reglas aprobadas de RF-01 no definen una transicion obligatoria al abrir o cerrar ordenes.

## 10. Actualizacion preventiva

Al cerrar una orden preventiva vinculada a una programacion se conserva la orden historica y la foto de objetivos copiados. No se actualiza automaticamente la siguiente fecha o kilometraje porque el modelo fisico vigente no contiene campos de intervalo aprobados para recalcular un nuevo objetivo. RF-04 valida y documenta esta limitacion en vez de inventar reglas o crear una programacion nueva.

## 11. Frontend

La ruta `/ordenes-trabajo` queda conectada a API real.

Administrador:

- resumen con datos reales;
- listado con busqueda, filtros, ordenamiento y paginacion;
- creacion manual correctiva;
- detalle con bus, origen, historial, reasignaciones, intervenciones, actividades, consumos y costos;
- asignacion, reasignacion, devolucion y cierre con dialogos accesibles.

Mecanico:

- listado de ordenes propias;
- detalle autorizado;
- inicio y reanudacion;
- formularios de diagnostico, observaciones, actividades y consumo;
- resumen de consumos y costo basico;
- completado tecnico con confirmacion previa.

Conductor:

- acceso denegado al modulo interno de ordenes;
- RF-02 queda intacto para seguimiento de novedades.

## 12. Persistencia y migracion

RF-04 reutiliza las entidades fisicas existentes. Solo fue necesaria una migracion minima para idempotencia de consumo:

```text
src/backend/prisma/migrations/20260828121500_rf04_consumo_idempotencia/migration.sql
```

La migracion agrega:

- `consumos_repuesto.clave_idempotencia uuid null`.
- `ux_consumos_repuesto_clave_idempotencia` como indice unico parcial cuando la clave no es nula.

No se editaron migraciones historicas.

## 13. Pruebas automatizadas

Backend `src/backend/test/work-order.test.ts` cubre:

- autenticacion obligatoria, roles canonicos, usuario inactivo y acceso denegado a Conductor;
- ordenes de RF-02 y RF-03 visibles en RF-04 con relaciones conservadas;
- creacion manual correctiva y rechazo de campos protegidos;
- listado, resumen, filtros, busqueda, detalle, historial y reasignaciones;
- asignacion, reasignacion y perdida inmediata de escritura del mecanico anterior;
- inicio, reanudacion, diagnostico, observaciones y actividades;
- consumo con stock suficiente, insuficiente, idempotencia, movimiento y costo;
- concurrencia de consumo, asignacion, cierre y doble cierre;
- completado tecnico, devolucion, segundo ciclo de correccion y orden cerrada terminal;
- preventiva cerrada sin iniciar RF-05 ni RF-06.

Frontend `src/frontend/src/App.test.tsx` cubre:

- Administrador con resumen, listado, filtros, creacion, asignacion, reasignacion, devolucion y cierre;
- Mecanico con listado propio, inicio, tecnica, actividad, consumo y completado;
- Conductor denegado;
- regresion de paneles y navegacion de RF-01, RF-02 y RF-03.

## 14. Evidencias visuales

Las capturas RF-04 se conservan en `docs/screenshots/` con prefijo `rf04-`.

Vistas verificadas:

- administrador: resumen, listado/filtros, creacion, detalle pendiente, asignacion, reasignacion, completada, devolucion, cierre y cerrada;
- mecanico: mis ordenes, detalle asignado, ejecucion, diagnostico/actividades, consumo, resumen, completado, devuelta y movil;
- viewports `1440x900`, `1024x768` y `390x844`.

## 15. Validacion de cierre

Validacion ejecutada el 2026-08-28 sobre la rama `feat/rf-04-ordenes-trabajo`:

- RF-03 integrado en `main` con ancestro `2118d6c5957233835f185077e4eedd8df645a317`.
- Baseline previa limpia desde `main`.
- Migracion RF-04 aplicada y validada con Prisma/Neon.
- Neon temporal `rf04_final_20260828_1710`: 6 migraciones desde cero, seed dos veces, RF-04 backend `11/11` y eliminacion del schema al terminar.
- Diferencia documentada: un primer intento temporal recibio `P1002` al adquirir el advisory lock de Prisma; se repitio en un schema nuevo con `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1`, sin migraciones simultaneas, y la validacion fue exitosa.
- Frontend: `34/34`.
- Backend: `69/69`.
- RF-04 backend aislado: `11/11`.
- RF-04 frontend aislado: `5/5`.
- Typecheck y lint de frontend/backend correctos.
- Build, audit, formato, secretos, capturas y push se registran en el cierre operativo.
