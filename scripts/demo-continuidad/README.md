# Continuidad simulada de la demo — lote 09-11-2026

Herramienta de mantenimiento **de una sola aplicación**, no un seed general ni un cron. Reconstruye el escenario AMB de 22 buses entre el 15 de octubre y el corte del 9 de noviembre de 2026. La autorización del propietario permite esta simulación histórica; no acredita trabajo empresarial real.

## Alcance y preservación

- Registra las jornadas mediante inicio/final y lecturas coherentes; conserva la separación entre proyección de ruta y kilometraje simulado.
- Reasigna por jornadas sucesoras, sin sobrescribir bus/conductor/agenda de la original.
- Recorre cada objetivo semanal vencido, con orden, intervención, actividad, lecturas de taller, estados y siguiente obligación. Continúa la orden manual previa sin alterar su creación/asignación.
- Incorpora novedades, correctivos, consumos compatibles y movimientos de inventario. Sus descripciones/evidencias declaran `SIMULADO_SGMV`.
- Conserva cuentas, rutas oficiales, planes, registros ajenos al horizonte, fotografías y auditoría previa. Los cinco vehículos anteriores/archivados no se convierten en operación AMB ni se borran.
- No ejecuta fechas futuras. Deja 11 jornadas actuales y casos técnicos legítimamente abiertos; no pretende un tablero artificialmente sin pendientes.

## Requisitos

Node24 y herramientas PostgreSQL (`psql`; `PG_BIN` permite elegir su directorio). La conexión se suministra al proceso como `DATABASE_URL` por un mecanismo privado. No coloque contraseñas o conexiones en comandos, archivos versionados, incidencias o logs. El wrapper del operador puede configurar la conexión únicamente en memoria mediante `configureConnection`.

Previamente: verificar rama/base de producción, inventario actual, respaldo consistente y restauración en una copia local aislada. Una copia Neon no sustituye el ensayo de recuperación. No reutilice ciegamente los IDs/fechas de este lote para otra fecha o base.

## Uso

En una base local cuyo nombre comience por `sgmv_demo_rehearsal_`, con conexión ya suministrada:

```powershell
node scripts/demo-continuidad/run.mjs --plan=RUTA_PRIVADA_PLAN.json --cutoff=2026-11-09T18:04:05.991Z
node scripts/demo-continuidad/run.mjs --plan=RUTA_PRIVADA_PLAN.json --apply --confirm-simulation
node --test scripts/demo-continuidad/plan.test.mjs
```

Producción añade `--expected-host=HOST_VERIFICADO.neon.tech`. Es una comprobación de destino, no una autorización genérica para cualquier base Neon. Antes de aplicar deben coincidir la huella del inventario y el plan ensayado. Los planes, SQL generados, recibos y backups son privados y se guardan **fuera del checkout**.

La aplicación es una transacción: bloquea recursos, conserva restricciones/triggers, comprueba filas protegidas, fuerza las comprobaciones diferidas y ejecuta diez verificaciones antes de COMMIT. No desactiva claves, triggers ni validaciones. Un marcador de auditoría y un bloqueo asesor impiden duplicar el lote. Una repetición devuelve `ALREADY_APPLIED`, no vuelve a avanzar odómetros o stock.

El identificador fijo `cc261109-0000-4000-8000-000000000001` pertenece exclusivamente a este corte. Para continuidad posterior hace falta un nuevo inventario y un nuevo plan incremental revisado; **esta herramienta no mantiene sola la demo avanzando cada día**.

## Recuperación

Ante un error antes de COMMIT, PostgreSQL revierte los cambios de dominio; las secuencias pueden avanzar sin que eso represente registros perdidos. Ante una interrupción de transporte, consultar primero el marcador/recibo y los conteos: no asumir fallo ni reejecutar. Restaurar toda producción es una operación destructiva separada; conservar el backup y preparar una corrección selectiva/roll-forward cuando sea posible.

## Verificación y límites

`verify.sql` verifica lecturas iniciales/finales, cadena de odómetro, ausencia de ejecución futura, solapamientos de mecánicos, jornadas durante bloqueos, costos, relación consumo/movimiento, stock y vencimientos semanales. El ensayo también verificó idempotencia y lectura mediante la API real del prototipo.

`smoke.mjs` comprueba los cuatro roles y ausencia de campos económicos donde no corresponden, usando sesiones efímeras de diagnóstico. No cambia credenciales ni demuestra login por contraseña, navegación visual o funcionamiento de medios externos.
