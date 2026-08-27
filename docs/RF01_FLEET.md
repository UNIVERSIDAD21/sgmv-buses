# RF-01 - Gestion de la flota vehicular

**Estado:** implementado end-to-end en rama `feat/rf-01-flota`.

RF-01 conecta:

`Frontend -> API REST -> controladores -> servicios -> repositorios -> Prisma -> PostgreSQL/Neon`

No se modifico `schema.prisma` ni se crearon migraciones para este bloque.

---

## Alcance implementado

- Listado real de buses con paginacion, busqueda por codigo/placa y filtro por estado.
- Consulta de detalle de bus.
- Registro de bus.
- Edicion de datos permitidos.
- Registro atomico de kilometraje e historial.
- Cambio atomico de estado e historial.
- Asignacion y reasignacion transaccional de conductor.
- Consulta de conductores disponibles.
- Consulta del bus asignado al conductor autenticado.
- Panel administrador con indicadores reales de flota.
- Panel conductor con bus asignado real o estado vacio.
- Historiales de kilometraje, estados y asignaciones.

Fuera de este bloque quedan RF-02, RF-03, RF-04, RF-05 y RF-06.

---

## Endpoints

Todos los endpoints requieren sesion por cookie `HttpOnly`.

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/flota/resumen` | Administrador | Totales de buses, estados y asignaciones activas. |
| `GET` | `/flota/buses` | Administrador | Lista buses con `pagina`, `limite`, `busqueda` y `estado`. |
| `POST` | `/flota/buses` | Administrador | Registra bus y crea historial inicial de estado. |
| `GET` | `/flota/buses/:busId` | Administrador; Conductor asignado | Detalle de bus. El conductor solo accede si ese bus es su asignacion activa. |
| `PATCH` | `/flota/buses/:busId` | Administrador | Edita codigo, placa, marca, modelo y anio. No edita estado ni kilometraje. |
| `POST` | `/flota/buses/:busId/kilometraje` | Administrador | Actualiza kilometraje y crea `LecturaKilometraje` en una transaccion. |
| `GET` | `/flota/buses/:busId/kilometraje` | Administrador | Consulta lecturas historicas. |
| `POST` | `/flota/buses/:busId/estado` | Administrador | Cambia estado y crea `BusEstadoHistorial` en una transaccion. |
| `GET` | `/flota/buses/:busId/estados` | Administrador | Consulta historial de estados. |
| `POST` | `/flota/buses/:busId/asignaciones` | Administrador | Asigna/reasigna conductor; cierra historicos necesarios dentro de la transaccion. |
| `GET` | `/flota/buses/:busId/asignaciones` | Administrador | Consulta historial de asignaciones. |
| `GET` | `/flota/conductores-disponibles` | Administrador | Lista conductores activos sin asignacion activa, mas el actual del bus si se envia `busId`. |
| `GET` | `/flota/mi-bus` | Conductor | Devuelve su bus asignado y resumen autorizado. |

Las rutas de escritura aplican validacion de `Origin` mediante `enforceAllowedOrigin`.

---

## Entradas principales

### Registrar bus

```json
{
  "codigoInterno": "BUS-001",
  "placa": "SGM001",
  "marca": "Mercedes-Benz",
  "modelo": "OF-1721",
  "anio": 2020,
  "kilometrajeActual": 45200,
  "estadoOperativo": "OPERATIVO",
  "motivoEstado": "Registro inicial"
}
```

### Editar bus

Solo acepta:

```json
{
  "codigoInterno": "BUS-001",
  "placa": "SGM001",
  "marca": "Mercedes-Benz",
  "modelo": "OF-1721",
  "anio": 2020
}
```

Campos internos, auditoria, estado y kilometraje son rechazados por Zod.

### Registrar kilometraje

```json
{
  "kilometrajeNuevo": 45300,
  "motivo": "Lectura validada"
}
```

### Cambiar estado

```json
{
  "estadoNuevo": "EN_MANTENIMIENTO",
  "motivo": "Revision programada"
}
```

### Asignar conductor

```json
{
  "conductorId": "uuid-del-conductor",
  "motivo": "Reasignacion por disponibilidad"
}
```

---

## Reglas aplicadas

- Placa y codigo interno se normalizan a mayusculas sin espacios.
- Duplicados por diferencias de mayusculas/minusculas responden `409`.
- Solo se aceptan estados del enum `EstadoBus`.
- No existe endpoint de eliminacion fisica de bus.
- Kilometraje nuevo no puede ser inferior al actual.
- Actualizacion de kilometraje y `LecturaKilometraje` son atomicos.
- Cambio de estado y `BusEstadoHistorial` son atomicos.
- Motivo es obligatorio para cambios de estado.
- Las lecturas e historiales no se editan ni eliminan desde RF-01.
- Un conductor y un bus tienen maximo una asignacion activa.
- Reasignar cierra asignaciones activas previas y crea la nueva en la misma transaccion.
- Solo se asignan usuarios activos con rol `CONDUCTOR`.
- El responsable siempre sale de la sesion autenticada.
- El conductor no puede consultar buses ajenos ni historiales administrativos.
- El mecanico no participa en RF-01 y recibe acceso denegado.

---

## Evidencia visual

- `docs/screenshots/rf01-flota-listado-1440x900.png`
- `docs/screenshots/rf01-flota-listado-1024x768.png`
- `docs/screenshots/rf01-flota-listado-390x844.png`
- `docs/screenshots/rf01-bus-formulario-1440.png`
- `docs/screenshots/rf01-bus-detalle-1440.png`
- `docs/screenshots/rf01-kilometraje-1440.png`
- `docs/screenshots/rf01-cambio-estado-1440.png`
- `docs/screenshots/rf01-asignacion-conductor-1440.png`
- `docs/screenshots/rf01-vista-conductor-390.png`

Playwright verifico viewports `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina. Tambien se verifico foco alcanzable con teclado despues de `Tab` en listado, formulario, detalle, dialogos y vista conductor.
