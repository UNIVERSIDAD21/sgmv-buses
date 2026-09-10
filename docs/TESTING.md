# Testing

## Estado final P14

El Gate vigente aprobó 175 pruebas backend, 74 frontend, las suites Playwright locales,
el smoke productivo 4/4 y el capturador de 16 evidencias. La corrección RF-04 valida
explícitamente que Mecánico, Despachador y Conductor no reciben campos económicos y que
Administrador conserva los costos autorizados. `npm audit` reportó cero vulnerabilidades
y `p12:audit` aprobó licencias y escaneo de secretos sin hallazgos bloqueantes.

Comandos y trazabilidad: `docs/p14/INVENTARIO_FINAL.md` y
`docs/p14/MATRIZ_MAESTRA.csv`.

## Estado actual

El codigo existente cuenta con pruebas para RF-01 a RF-06 y ya incluye autenticacion y regresion inicial para los cuatro roles canonicos. Tambien existe un bloque de pruebas de integridad para la migracion del modelo revisado. Aun faltan pruebas de servicios, API, permisos, concurrencia e interfaz para jornadas, alertas, compatibilidad y kilometraje contextual.

## Pruebas existentes que deben conservarse

- Autenticacion y autorizacion.
- RF-01 flota.
- RF-02 novedades.
- RF-03 mantenimiento preventivo.
- RF-04 ordenes de trabajo.
- RF-05 repuestos.
- RF-06 historial e informes.
- Validaciones Zod.
- Transacciones de stock y consumo.
- Historial derivado.
- Restriccion de costos por rol.
- Pruebas visuales responsive.

## Pruebas del nuevo alcance

### Roles: cobertura inicial implementada y ampliacion requerida

- Conservar las pruebas existentes de inicio de sesion de `DESPACHADOR` y los cuatro roles canonicos.
- Ampliar la cobertura de navegacion operativa del Despachador al incorporar cada modulo.
- Despachador no accede a usuarios, costos, diagnosticos ni repuestos administrativos.
- Administrador conserva permisos superiores.
- Mecanico y Conductor no ganan permisos nuevos indebidos.

### Jornadas

- Crear jornada valida.
- Rechazar conductor superpuesto.
- Rechazar bus superpuesto.
- Rechazar bus en mantenimiento, fuera de servicio o inactivo.
- Registrar salida con kilometraje inicial.
- Registrar llegada con kilometraje final.
- Rechazar kilometraje final inferior.
- Reasignacion conserva responsable, fecha y motivo.

### Novedades

- Novedad deriva jornada, conductor y bus desde backend.
- Novedad guarda kilometraje contextual.
- Novedad critica alerta al Despachador.
- Novedad critica puede bloquear bus.
- Conversion a orden conserva jornada-novedad-orden.

### Preventivos

- Plan por bus/modelo/componente.
- Intervalos por fecha y kilometraje.
- Generacion de alerta por proximo/vencido.
- Bloqueo operativo por mantenimiento critico vencido.
- Calculo de siguiente objetivo al cerrar intervencion.

### Ordenes

- Kilometraje de ingreso a taller.
- Kilometraje de cierre.
- Relacion con jornada cuando proviene de novedad operativa.
- Despachador consulta solo estado operativo.

### Repuestos

- Crear compatibilidad.
- Filtrar compatibles durante orden.
- Bloquear consumo incompatible.
- Autorizar excepcion con responsable y motivo.
- Mantener stock e historial consistentes.

### Alertas

- Crear alerta por evento.
- Mostrar alerta segun rol.
- Marcar como leida.
- Marcar como atendida.
- Impedir lectura de alerta ajena.
- Relacionar alerta con entidad origen.

### Historial e informes

- Reconstruir trazabilidad completa.
- Filtrar por jornada, kilometraje, novedad, orden, repuesto y alerta.
- Despachador sin costos ni diagnosticos.
- Conductor solo informacion propia.

## Comandos habituales

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run prisma:validate`
- `npm run prisma:generate`

## Cierre esperado

La realineacion queda cerrada solo cuando backend, frontend, migraciones, seed, pruebas y evidencias visuales reflejen cuatro roles y la trazabilidad operacional-tecnica actualizada.
