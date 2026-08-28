# RF-03 - Administracion del mantenimiento preventivo

## 1. Alcance implementado

RF-03 permite al Administrador programar, consultar, filtrar, reprogramar y controlar mantenimientos preventivos de buses por fecha, por kilometraje o por ambos criterios. Tambien permite generar una orden preventiva cuando la programacion esta `PROXIMO` o `VENCIDO`.

No implementa RF-04: no asigna Mecanico, no inicia ejecucion, no registra diagnosticos, no registra actividades, no consume repuestos y no cierra ordenes.

## 2. Roles

- `ADMINISTRADOR`: unico rol autorizado para resumen, listado, detalle, creacion, reprogramacion y generacion de orden preventiva.
- `CONDUCTOR`: acceso denegado a las operaciones administrativas de RF-03.
- `MECANICO`: acceso denegado a las operaciones administrativas de RF-03.

Los alias heredados `ADMIN_SUPERVISOR` y `CONDUCTOR_OPERADOR` no se aceptan como roles validos en tokens ni autorizacion.

## 3. Endpoints

Todos los endpoints requieren autenticacion.

| Metodo | Ruta | Rol | Proposito |
|---|---|---|---|
| `GET` | `/mantenimiento-preventivo/resumen` | `ADMINISTRADOR` | Resumen administrativo con conteos y umbrales. |
| `GET` | `/mantenimiento-preventivo/programaciones` | `ADMINISTRADOR` | Lista paginada con busqueda, filtros y ordenamiento. |
| `POST` | `/mantenimiento-preventivo/programaciones` | `ADMINISTRADOR` | Crea programacion preventiva. |
| `GET` | `/mantenimiento-preventivo/programaciones/:programacionId` | `ADMINISTRADOR` | Consulta detalle. |
| `PATCH` | `/mantenimiento-preventivo/programaciones/:programacionId` | `ADMINISTRADOR` | Reprograma campos autorizados. |
| `POST` | `/mantenimiento-preventivo/programaciones/:programacionId/generar-orden` | `ADMINISTRADOR` | Genera o devuelve orden preventiva activa. |

Los endpoints de escritura aplican `enforceAllowedOrigin`.

## 4. DTO de programacion

La respuesta segura incluye:

- `id`, `tipo`, `actividad`, `criterio`, `fechaProgramada`, `kilometrajeObjetivo`, `activa`.
- `bus`: identificador, codigo interno, placa, marca, modelo, anio, estado operativo y kilometraje actual oficial.
- `creadaPor`: id, nombre y email del administrador.
- `clasificacion`: estado calculado, dias restantes, kilometros restantes y criterio que produjo el resultado.
- `ordenActiva`: resumen de la orden preventiva activa, si existe.
- `createdAt`, `updatedAt`.

No se exponen contrasenas, hashes, tokens ni campos internos no necesarios.

## 5. Reglas de clasificacion

La clasificacion se calcula en servidor mediante una regla centralizada en `src/backend/src/preventive/preventive.classification.ts`.

Configuracion:

- `PREVENTIVE_SOON_DAYS=7`
- `PREVENTIVE_SOON_KM=500`
- Zona horaria operacional: `America/Bogota`

Reglas:

- `VENCIDO` si la fecha objetivo ya paso o si `kilometrajeActual >= kilometrajeObjetivo`.
- `PROXIMO` si no esta vencido y faltan 7 dias calendario o menos, o faltan entre 1 y 500 km.
- `VIGENTE` si no esta vencido ni proximo.
- En programaciones combinadas, cualquier criterio vencido domina; si ninguno vence, cualquier criterio proximo domina.

El kilometraje actual se toma siempre desde `buses.kilometraje_actual`, actualizado por RF-01. El cliente no puede enviar kilometraje actual ni estado calculado.

## 6. Creacion y reprogramacion

La creacion valida con Zod:

- `busId` UUID existente.
- `tipo` entre 3 y 120 caracteres.
- `actividad` entre 10 y 2000 caracteres.
- `criterio`: `FECHA`, `KILOMETRAJE` o `FECHA_KILOMETRAJE`.
- `fechaProgramada` en formato `YYYY-MM-DD` cuando aplica.
- `kilometrajeObjetivo` entero positivo cuando aplica.

La reprogramacion usa `PATCH` con lista blanca:

- `tipo`
- `actividad`
- `criterio`
- `fechaProgramada`
- `kilometrajeObjetivo`
- `activa`

No permite cambiar ids, bus, creador, auditoria ni relaciones internas. Si existe una orden preventiva activa asociada, la programacion queda bloqueada para modificacion.

## 7. Generacion de orden preventiva

La accion es explicita y protegida para Administrador.

La orden se crea solo cuando la programacion esta `PROXIMO` o `VENCIDO`. Una programacion `VIGENTE` es rechazada.

La orden generada:

- `tipo = PREVENTIVA`
- `origen = PREVENTIVO`
- `estado = PENDIENTE_ASIGNACION`
- mismo `bus_id` de la programacion
- `programacion_mantenimiento_id` obligatorio
- `tecnico_asignado_id = null`
- copia `fecha_objetivo_preventivo` y/o `kilometraje_objetivo_preventivo`
- crea historial inicial en `orden_estado_historial`

RF-03 no asigna ni ejecuta la orden. Esa gestion inicia en RF-04.

## 8. Concurrencia e idempotencia

La generacion de orden se ejecuta dentro de una transaccion Prisma:

1. Lee la programacion con su orden preventiva activa.
2. Si ya existe orden activa, devuelve el resumen con `yaExistia=true`.
3. Si no existe, crea la orden preventiva y el historial inicial en la misma transaccion.

La base protege duplicados con el indice unico parcial `ux_orden_preventiva_activa_por_programacion`. Dos solicitudes simultaneas no pueden dejar dos ordenes activas para la misma programacion; si una transaccion pierde la carrera, se recarga la orden existente y se responde de forma segura.

## 9. Persistencia

No fue necesaria una migracion nueva para RF-03. La estructura existente ya incluia:

- `programaciones_mantenimiento`
- `ordenes_trabajo.programacion_mantenimiento_id`
- `ordenes_trabajo.fecha_objetivo_preventivo`
- `ordenes_trabajo.kilometraje_objetivo_preventivo`
- FK compuesta para asegurar que la orden preventiva pertenece al mismo bus de la programacion
- indice unico parcial de orden preventiva activa por programacion
- historial de estados de orden

Las migraciones historicas no se editaron.

## 10. Frontend

La ruta `/mantenimiento-preventivo` muestra al Administrador:

- resumen preventivo con contadores reales;
- listado paginado;
- busqueda por actividad, tipo, placa o codigo;
- filtros por clasificacion, bus y criterio;
- ordenamiento;
- formulario de creacion por fecha, kilometraje o ambos;
- detalle con dias/km restantes;
- reprogramacion autorizada;
- confirmacion accesible para generar orden preventiva;
- estado vacio, carga y error.

Conductor y Mecanico reciben acceso denegado y no ven controles administrativos.

## 11. Pruebas

Backend:

- acceso y permisos por rol;
- rechazo de usuarios inactivos y alias heredados;
- creacion por fecha, kilometraje y combinada;
- validaciones y campos internos rechazados;
- bus inexistente e inactivo;
- duplicado logico;
- limites de clasificacion por fecha y kilometraje;
- resumen, listado, filtros, busqueda, paginacion y detalle;
- reprogramacion controlada;
- recalculo con kilometraje oficial RF-01;
- generacion de orden preventiva;
- orden ya existente;
- concurrencia con `Promise.all`;
- rollback transaccional.

Frontend:

- ruta protegida;
- administrador con acceso;
- conductor y mecanico denegados;
- resumen real;
- listado, busqueda, filtros y paginacion;
- formularios por fecha, kilometraje y combinado;
- validacion sin criterio;
- prevencion de doble envio;
- detalle, badges y valores restantes;
- reprogramacion;
- generacion de orden;
- estados vacio/error.

## 12. Evidencias visuales

Capturas generadas en `docs/screenshots/`:

- `rf03-summary-1440x900.png`
- `rf03-list-1440x900.png`
- `rf03-filters-1024x768.png`
- `rf03-form-date-1440x900.png`
- `rf03-form-combined-1440x900.png`
- `rf03-detail-vigente-1440x900.png`
- `rf03-detail-proximo-1440x900.png`
- `rf03-detail-vencido-1440x900.png`
- `rf03-generate-order-confirm-1440x900.png`
- `rf03-order-generated-1440x900.png`
- `rf03-mobile-390x844.png`
- `rf03-mobile-list-390x844.png`

## 13. Validacion

Validacion final ejecutada el 2026-08-27:

- `prisma format`, `prisma validate`, `prisma generate` y `prisma migrate status`: correctos.
- Instalacion desde cero en schema temporal de Neon `rf03_fresh_20260827_final3`: cinco migraciones aplicadas en orden oficial y seed ejecutado dos veces sin duplicados.
- Valores finales del enum `rol_codigo`: `ADMINISTRADOR`, `MECANICO`, `CONDUCTOR`.
- Tabla `roles`: un registro por rol canonico.
- Usuarios demo: `administrador.demo@sgmv.local`, `mecanico.demo@sgmv.local` y `conductor.demo@sgmv.local`, uno por perfil y sin `supervisor.demo@sgmv.local`.
- Login de los tres perfiles demo: correcto con rol canonico.
- Tokens heredados con `ADMIN_SUPERVISOR` y `CONDUCTOR_OPERADOR`: rechazados con `401`.
- Typecheck, lint, format check, pruebas frontend, pruebas backend, build, audit, revision de secretos y `git diff --check`: correctos.
- No se crearon migraciones nuevas para RF-03 y no se editaron migraciones historicas.
