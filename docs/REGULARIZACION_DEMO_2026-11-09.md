# Regularización integral de la demo · 9 de noviembre de 2026

La continuidad inicial no satisfizo el alcance global. El propietario reportó
jornadas bloqueadas y 25 buses sin conductor. Se confirmó 429 jornadas en atención
y 100 preventivos próximos/vencidos; no era caché. Esta edición sustituye ese cierre.

## Causas y corrección funcional

El primer lote actualizó 22 buses, pero omitió asignaciones base RF-01 y dejó tres
casos técnicos que afectaban 426 salidas futuras. Persistían casos antiguos fuera
del grupo. El resumen preventivo contaba 66 ciclos inactivos como vencidos.

- Los estados del resumen preventivo clasifican obligaciones **activas**. Total e
  inactivas conservan todo el historial; nada se borra.
- `requiereAtencion=true` exige una obligación activa próxima/vencida. La consulta
  histórica normal y `activa=false` mantienen acceso a las inactivas.
- Buses sin conductor cuenta buses no inactivos sin asignación base. El enlace y
  el contador comparten alcance; los archivados permanecen consultables en flota.
- Asignación base RF-01 no sustituye conductor/bus explícitos de cada jornada
  AM/PM. Se conserva la unicidad por bus y conductor.

## Lote adicional controlado

Respaldo actual completo restaurado antes de escribir. Marcador único:
`cc261109-0000-4000-8000-000000000002` / `DEMO_REGULARIZACION_COMPLETA`.
No repetir el lote inicial terminado en `0001`, ni seed, limpieza o restauración.

Se mantienen usuarios y credenciales existentes, rutas oficiales, planes, fotos,
lecturas originales y todas las jornadas salvo tres casos antiguos identificados.
No hay ejecución futura ni simulador diario automático.

- Se completan y validan los tres casos recientes y dos pendientes antiguos.
  Tres órdenes nuevas atienden aceite pendiente, revisión de BUS-002 y preventivo
  por kilometraje de SIM-AMB; recurrencia desde el objetivo anterior, sin saltos.
- Se anulan con motivo dos órdenes de validación sin ejecución. Nueve programas
  visuales y el del vehículo archivado se desactivan. Dos vehículos de validación
  pasan a INACTIVO con historial, no se eliminan.
- Dos jornadas históricas sin salida se cancelan con motivo. El demostrador abierto
  desde septiembre recibe cierre retrospectivo **simulado**, conservando inicio.
  Un puente administrativo rotulado concilia el salto heredado 45.000→45.200 km
  sin modificar lecturas originales ni atribuir distancia empresarial observada.
- 22 asignaciones base AMB y dos de demostradores complementan la de BUS-001.
  Termina la asignación de validación a un usuario inactivo. Un conductor nuevo
  de reserva tiene clave aleatoria no distribuida; ninguna clave existente cambia.
- Se resuelve la novedad menor restante y se repone la referencia bajo mínimo
  mediante movimiento académico trazable, no reinicio de existencias.

Trabajo adicional simulado: 13:30–15:32 Colombia; importación a su hora real.
Conciliaciones antiguas conservan fechas históricas explícitas. Nada acredita
operación de empresas, compras reales o certificación mecánica.

## Aceptación y evidencia

Ensayo desde respaldo: 25 buses operativos asignados, dos archivados, cero órdenes
abiertas, cero novedades pendientes, cero jornadas en atención y cero preventivos
vencidos. Quedan 22 inspecciones semanales **próximas para el 11 de noviembre**,
no atrasos. Las mensuales siguen el 13 de noviembre.

46 obligaciones activas: 44 AMB y dos por kilometraje. 79 ciclos inactivos siguen
consultables. Próximo objetivo SIM-AMB: 54.500 km desde 49.500 km, no desde el
odómetro actual. El paso del tiempo exige registrar nueva operación.

Backend 294/294, frontend 186/186, tipos/lint/build/formato PASS. Regresiones con
PostgreSQL comprueban 66 ciclos cerrados sin inflar atención y flota archivada sin
crear tareas de asignación. Antes de confirmar, la transacción verifica 14
invariantes globales, restricciones, origen y protección de historia.

SQL de referencia: `scripts/demo-continuidad/regularize.sql` y
`regularize-verify.sql`. La plantilla necesita sustituciones del orquestador
controlado: no ejecutarla manualmente ni repetir cargas para refrescar la interfaz.

Evidencia externa `diagnostics/sgmv-reactivacion-2026-11-09/correction-*`:
inventarios, respaldo privado, pruebas, resultados productivos y capturas. Estas
usan sesión diagnóstica firmada, no prueba de contraseña. Aceptación exige
contadores reales y cola completa, no solo HTTP 200 o salud del servicio.
