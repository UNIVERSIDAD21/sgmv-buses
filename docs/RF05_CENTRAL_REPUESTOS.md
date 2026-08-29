# RF-05 - Central de repuestos

**Estado:** implementado y validado el 2026-08-29.

RF-05 implementa la central administrativa de repuestos e insumos del taller usando las tablas fisicas existentes `repuestos`, `movimientos_inventario`, `consumos_repuesto`, `ordenes_trabajo` y `usuarios`. No crea tablas de compras, proveedores, bodegas, kardex paralelo ni reportes RF-06.

Diagrama de apoyo: `docs/diagrams/rf05-central-repuestos.html`.

## Alcance

- Catalogo paginado de repuestos e insumos en `/repuestos`.
- Busqueda por codigo, nombre y descripcion/categoria disponible.
- Filtros por estado activo/inactivo, disponibilidad y categoria.
- Resumen operativo con activos, disponibles, bajo stock, agotados, inactivos y valor basico actual.
- Alta de repuesto con stock cero o stock inicial trazable.
- Edicion controlada de datos maestros.
- Activacion y desactivacion logica.
- Entradas operativas de inventario.
- Ajustes administrativos por incremento o disminucion.
- Historial inmutable de movimientos general y por repuesto.
- Integracion visible con consumos creados por RF-04.

## Roles

Administrador:

- Accede a la Central de repuestos.
- Consulta resumen, catalogo, detalle e historial.
- Crea y edita datos maestros autorizados.
- Activa y desactiva repuestos.
- Registra entradas y ajustes.
- Consulta movimientos de consumo originados en RF-04.
- Ve costo unitario actual y valor basico de existencia.

Mecanico:

- No administra RF-05 ni ve la ruta `/repuestos`.
- Conserva solo la consulta operacional de repuestos disponibles dentro de RF-04.
- Registra consumos unicamente sobre una orden asignada en `EN_EJECUCION`.

Conductor:

- No participa en RF-05.
- No accede a stock, costos ni movimientos administrativos.

## Disponibilidad

La clasificacion se calcula en backend con `src/backend/src/spare-parts/spare-part.availability.ts`:

```text
INACTIVO: estado = INACTIVO
AGOTADO: stockActual = 0
BAJO: stockActual > 0 y stockActual <= stockMinimo
DISPONIBLE: stockActual > stockMinimo
```

`INACTIVO` domina visualmente sobre la disponibilidad por stock. El limite exacto de existencia minima queda clasificado como `BAJO`. La clasificacion no se recibe del cliente ni se persiste como verdad duplicada.

## Endpoints

Todos los endpoints administrativos requieren sesion activa y rol `ADMINISTRADOR`.

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/repuestos/resumen` | Resumen operativo y movimientos recientes. |
| `GET` | `/repuestos` | Catalogo paginado con busqueda, filtros y ordenamiento seguro. |
| `POST` | `/repuestos` | Alta de repuesto; stock inicial positivo crea movimiento `ENTRADA`. |
| `GET` | `/repuestos/:repuestoId` | Detalle administrativo. |
| `PATCH` | `/repuestos/:repuestoId` | Edicion controlada de datos maestros. No modifica stock. |
| `POST` | `/repuestos/:repuestoId/activar` | Reactivacion logica idempotente. |
| `POST` | `/repuestos/:repuestoId/desactivar` | Desactivacion logica; conserva historia y stock. |
| `POST` | `/repuestos/:repuestoId/entradas` | Entrada operativa trazable con clave idempotente. |
| `POST` | `/repuestos/:repuestoId/ajustes` | Ajuste administrativo con direccion explicita y motivo. |
| `GET` | `/repuestos/:repuestoId/movimientos` | Movimientos paginados por repuesto. |
| `GET` | `/inventario/movimientos` | Movimientos generales paginados. |

RF-04 conserva:

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/ordenes-trabajo/:ordenId/repuestos-disponibles` | Consulta minima de repuestos activos con stock positivo para la orden autorizada. |
| `POST` | `/ordenes-trabajo/:ordenId/consumos` | Consumo transaccional e idempotente de una orden en ejecucion. |

## Persistencia

RF-05 reutiliza el modelo fisico aprobado:

- `repuestos.stock_actual` conserva la existencia actual.
- `repuestos.stock_minimo` alimenta la clasificacion de alerta.
- `repuestos.costo_unitario` conserva el costo actual basico.
- `movimientos_inventario` funciona como historial operativo.
- `consumos_repuesto` conserva costo unitario y subtotal historicos de RF-04.

Se agrego una migracion minima:

```text
20260829101500_rf05_movimiento_idempotencia
```

La migracion agrega `movimientos_inventario.clave_idempotencia UUID NULL` y el indice unico parcial `ux_movimientos_inventario_clave_idempotencia`. La razon es proteger entradas, ajustes y stock inicial contra doble envio sin confundir operaciones legitimas iguales. No modifica migraciones historicas ni crea tablas nuevas.

## Transacciones y concurrencia

Entradas y ajustes usan transacciones Prisma sobre PostgreSQL con candado advisory transaccional por repuesto y actualizaciones atomicas condicionadas:

- las entradas acumulan cantidades concurrentes;
- los ajustes negativos exigen stock suficiente;
- un ajuste negativo concurrente con consumo RF-04 nunca deja stock negativo;
- cada operacion aplicada genera exactamente un movimiento;
- una clave idempotente repetida devuelve el movimiento existente sin duplicar stock;
- claves distintas permiten operaciones iguales legitimas.

RF-04 ya protege consumos con `consumos_repuesto.clave_idempotencia`, movimiento `CONSUMO` unico y descuento condicional.

El resumen y el catalogo RF-05 usan Prisma query builder para filtros, ordenamiento y paginacion. Esta decision evita el error del pooler Neon `cached plan must not change result type` observado al alternar schemas temporales con consultas crudas sobre tablas del mismo nombre.

## Frontend

La ruta `/repuestos` muestra:

- resumen operativo;
- buscador, filtros, ordenamiento y paginacion;
- tabla desktop y tarjetas responsivas;
- formulario de nuevo repuesto;
- detalle con movimientos por repuesto;
- dialogos de entrada, ajuste, activar y desactivar;
- estados de carga, error y vacio;
- botones deshabilitados durante envio.

Los estados de disponibilidad siempre muestran texto visible, no solo color.

## Pruebas

Backend:

- `src/backend/test/spare-part.test.ts` cubre autenticacion, roles, catalogo, creacion con/sin stock, duplicados, clasificacion, listado, entradas, ajustes, idempotencia, concurrencia, inactivos, integracion RF-04 y preservacion de costo historico.
- `src/backend/test/work-order.test.ts` conserva la cobertura de consumo RF-04 y valida que solo se ofrezcan repuestos activos con stock positivo.
- `src/backend/test/prisma-integrity.test.ts` conserva restricciones de consumo, movimientos y stock no negativo.

Neon temporal:

- Schema `rf05_final_20260829_1627`.
- 7 migraciones aplicadas desde cero.
- `prisma generate` ejecutado.
- Seed ejecutado dos veces con `SEED_USER_PASSWORD` temporal de proceso.
- Conteos tras seed: 3 roles, 4 usuarios, 2 buses, 1 novedad, 1 programacion, 2 ordenes, 4 repuestos, 1 consumo y 5 movimientos.
- Integridad: 0 codigos duplicados, 0 stocks negativos, 0 movimientos sin repuesto, 0 consumos sin repuesto, 0 consumos sin movimiento, 0 consumos con mas de un movimiento, 0 movimientos `CONSUMO` sin consumo, 0 consumos con orden inexistente y 0 responsables inexistentes.
- Backend RF-05 sobre schema temporal: 11/11.
- Schema eliminado al finalizar.

Frontend:

- `src/frontend/src/App.test.tsx` cubre la ruta administrativa, navegacion por rol, guard, resumen, catalogo, filtros, estados vacio/error, creacion, duplicados, detalle, edicion controlada, entrada, ajuste, confirmaciones, stock insuficiente, activacion/desactivacion e historial con referencia a orden RF-04.

## Exclusiones

RF-05 no implementa proveedores, compras, facturas, pagos, impuestos, bodegas multiples, lotes, series, codigos de barras, importaciones masivas, reportes consolidados, exportaciones ni la tabla fisica `Informe`. RF-06 permanece pendiente.
