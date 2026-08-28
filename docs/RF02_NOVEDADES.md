# RF-02 - Control de novedades operativas

**Estado:** implementado end-to-end en rama `feat/rf-02-novedades`.

RF-02 conecta:

`Frontend -> API REST -> controladores -> servicios -> repositorios -> Prisma -> PostgreSQL/Neon`

No se modifico `schema.prisma` ni se crearon migraciones para este bloque.

---

## Alcance implementado

- Registro real de novedades por Conductor.
- Asociacion automatica de autor, bus y fecha desde sesion/asignacion activa.
- Consulta de novedades propias del conductor con paginacion y filtro por estado.
- Consulta administrativa de todas las novedades con busqueda, paginacion y filtros por estado, clasificacion y prioridad de orden asociada.
- Detalle autorizado para conductor y detalle administrativo para Administrador.
- Revision controlada mediante acciones: clasificar, resolver sin orden y descartar.
- Conversion transaccional de novedad elegible en orden correctiva.
- Prevencion de orden duplicada por restriccion unica y manejo idempotente de reintentos/concurrencia.
- Primer historial de estado de orden generado en la conversion.
- Panel administrador con indicador real de novedades pendientes.
- Panel conductor con bus real, novedades recientes y acceso a registro.

Fuera de este bloque quedan RF-03, RF-04, RF-05 y RF-06. En el cierre de RF-02, la asignacion tecnica, ejecucion, intervenciones, consumos y cierre de ordenes quedaban para RF-04.

---

## Endpoints

Todos los endpoints requieren sesion por cookie `HttpOnly`.

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/novedades` | Conductor | Registra una novedad para el bus asignado activo. No acepta `busId`, `conductorId` ni campos internos. |
| `GET` | `/novedades/mis-novedades` | Conductor | Lista novedades propias con `pagina`, `limite`, `busqueda`, `estado`, `tipo` y `clasificacion`. |
| `GET` | `/novedades/mis-novedades/:novedadId` | Conductor | Consulta detalle autorizado de una novedad propia. |
| `GET` | `/novedades/resumen` | Administrador | Devuelve totales por estado, pendientes y ordenes generadas. |
| `GET` | `/novedades` | Administrador | Lista todas las novedades con `pagina`, `limite`, `busqueda`, `estado`, `tipo`, `clasificacion` y `prioridad`. |
| `GET` | `/novedades/:novedadId` | Administrador | Consulta detalle administrativo de una novedad. |
| `POST` | `/novedades/:novedadId/revision` | Administrador | Ejecuta una accion controlada de revision. |
| `POST` | `/novedades/:novedadId/convertir-orden` | Administrador | Convierte una novedad pendiente en orden correctiva y crea historial inicial. |

Las rutas de escritura aplican validacion de `Origin` mediante `enforceAllowedOrigin`.

---

## Entradas principales

### Registrar novedad

```json
{
  "tipo": "Ruido en frenos",
  "descripcion": "Se escucha ruido al frenar en pendientes durante la ruta."
}
```

El backend obtiene `conductorId`, `busId` y `fechaReporte`; si el cliente envia IDs o campos extra, Zod los rechaza.

### Revisar novedad

Clasificar:

```json
{
  "accion": "CLASIFICAR",
  "clasificacion": "Falla mecanica",
  "observacion": "Requiere seguimiento"
}
```

Resolver sin orden:

```json
{
  "accion": "RESOLVER_SIN_ORDEN",
  "observacion": "No se encontro falla reproducible"
}
```

Descartar:

```json
{
  "accion": "DESCARTAR",
  "observacion": "Reporte duplicado o no procedente"
}
```

No existe `PATCH` abierto para modificar autor, bus, fecha, relaciones ni campos internos.

### Convertir en orden correctiva

```json
{
  "prioridad": "MEDIA",
  "observacion": "Se genera orden correctiva",
  "descripcionOrden": "Revision de sistema de frenos reportado por conductor"
}
```

Si `descripcionOrden` se omite, el servicio usa una descripcion segura basada en la novedad. La orden queda en `PENDIENTE_ASIGNACION`, sin tecnico asignado, porque la asignacion corresponde a RF-04.

---

## Reglas aplicadas

- Solo un Conductor activo puede registrar novedades.
- El autor se obtiene de la sesion autenticada.
- El bus se obtiene de la asignacion activa del conductor.
- Si no hay asignacion activa, el registro se rechaza con un mensaje claro.
- La fecha de reporte se genera en servidor.
- El estado inicial oficial es `PENDIENTE_REVISION`.
- Los estados validos son exclusivamente los definidos por Prisma y decisiones aprobadas: `PENDIENTE_REVISION`, `RESUELTA_SIN_ORDEN`, `DESCARTADA`, `CONVERTIDA_A_ORDEN`.
- Solo se permiten transiciones desde `PENDIENTE_REVISION`.
- Los estados terminales no se modifican desde RF-02.
- El conductor solo consulta novedades propias y no recibe controles administrativos.
- El mecanico no participa en RF-02 y recibe acceso denegado.
- La conversion crea `OrdenTrabajo` correctiva con `origen = NOVEDAD`, mismo bus, sin tecnico y estado `PENDIENTE_ASIGNACION`.
- La conversion crea el primer `OrdenEstadoHistorial`.
- La conversion actualiza la novedad a `CONVERTIDA_A_ORDEN`.
- Conversion de orden, historial y actualizacion de novedad ocurren en una sola transaccion.
- Dos solicitudes simultaneas no pueden crear dos ordenes por la misma novedad.
- No se implemento borrado fisico de novedades.

---

## Diferencias justificadas

- `novedades` no tiene campo fisico `prioridad`; por eso el conductor no envia prioridad y el administrador solo define prioridad al generar la `OrdenTrabajo`. El listado administrativo permite filtrar por prioridad cuando ya existe una orden asociada.
- La clasificacion es un texto administrativo (`clasificacion`) definido en el modelo. El conductor solo envia `tipo` y `descripcion`.
- La orden generada se muestra como resumen y referencia. La asignacion tecnica, ejecucion, intervenciones, consumos y cierre se gestionan posteriormente desde RF-04.

---

## Evidencia visual

- `docs/screenshots/rf02-driver-form-1440x900.png`
- `docs/screenshots/rf02-driver-list-1440x900.png`
- `docs/screenshots/rf02-novelty-detail-1440x900.png`
- `docs/screenshots/rf02-admin-panel-1440x900.png`
- `docs/screenshots/rf02-admin-filters-1024x768.png`
- `docs/screenshots/rf02-review-dialog-1440x900.png`
- `docs/screenshots/rf02-convert-dialog-1440x900.png`
- `docs/screenshots/rf02-order-generated-1440x900.png`
- `docs/screenshots/rf02-mobile-390x844.png`

Playwright verifico viewports `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina, con tablas desplazables en movil, formularios legibles, dialogos/drawers accesibles y foco alcanzable por teclado.
