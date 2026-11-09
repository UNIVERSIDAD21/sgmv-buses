# Demo SGMV — puesta al día del 9 de noviembre de 2026

Esta es una **simulación académica autorizada**, no una acreditación de recorridos, lecturas o mantenimientos de empresas reales. El período reconstruido corresponde al escenario AMB iniciado el 15 de octubre, con corte a las **13:04 del 09-11-2026, Colombia**.

## Qué contiene el escenario actualizado

| Elemento | Estado al corte |
| --- | --- |
| Buses del horizonte AMB | 22, principales y reservas |
| Jornadas finalizadas | 473 |
| Jornadas actuales en curso | 11 |
| Cambios a reserva | 14 jornadas originales REASIGNADA y sus sucesoras trazadas |
| Jornadas futuras conservadas | 1.562, hasta el 31-01-2027, sin ejecución inventada |
| Órdenes cerradas | 77: 66 ciclos preventivos y 11 correctivos |
| Órdenes técnicas actuales | 1 ASIGNADA, 1 EN_EJECUCION y 1 COMPLETADA_TECNICO |
| Novedades | 26: 14 convertidas, 11 resueltas sin orden y 1 pendiente de revisión |
| Lecturas de kilometraje | 1.139, con contexto y cadena coherente |
| Obligaciones activas | 44; siguiente inspección semanal 11-11 y revisión30d 13-11 |
| Inventario simulado | 13 consumos con movimiento y 2 reposiciones trazables |

Los cinco vehículos anteriores/archivados y su historial, cuentas, rutas oficiales y planes se conservaron. Esos registros históricos no se renombran como operación AMB ni se borran para producir un tablero sin pendientes. Los datos nuevos están identificados como `SIMULADO_SGMV` en actividades, lecturas, novedades y auditoría.

## Casos actuales para recorrer

Utilice las credenciales existentes de las cuentas del escenario; esta intervención no cambia contraseñas ni roles. No publique credenciales en documentos o capturas.

| Rol/cuenta | Dónde mirar | Caso |
| --- | --- | --- |
| Administrador: `administrador.amb.demo@sgmv.local` | Órdenes → buscar `SIM261109-C-A-113` | COTRANDER principal: trabajo completado por el técnico, pendiente de revisión/cierre administrativo |
| Administrador | Novedades → pendientes | TRANSGIRÓN: observación interior del conductor pendiente de clasificar |
| Despachador: `despachador.amb.demo@sgmv.local` | Jornadas y proyección técnica | Principales109/111/113 atendidos en taller; turno PM con reservas110/112/114 mediante sucesoras, no sobrescritura |
| Mecánico: `mecanico.unitransa.demo@sgmv.local` | Mis órdenes → `SIM261109-C-A-109` | Diagnóstico en ejecución con actividad y consumo registrado; permite continuar el flujo técnico |
| Mecánico: `mecanico.transcolombia.demo@sgmv.local` | Mis órdenes → `SIM261109-C-A-111` | Asignada, aún sin iniciar |
| Mecánico: `mecanico.cotrander.demo@sgmv.local` | Mis órdenes → `SIM261109-C-A-113` | Completada técnicamente, pendiente de validación del Administrador |
| Conductor: `conductor.unitransa.pm.demo@sgmv.local` | Mi jornada | Turno PM actual con el bus de reserva SIM-UNITRANSA-02; lectura inicial y contexto de ruta |

Cambiar estados desde la interfaz avanza realmente la demo. No cierre los tres casos de ejemplo si desea conservarlos para una demostración posterior. Los ejemplos corresponden a la hora de corte: al transcurrir sus horarios aparecerán pendientes normales si no se registran las acciones siguientes.

## Historial para revisar

Filtre por `SIM-...`, el período15-10 a09-11 y la empresa de referencia. Encontrará ciclos semanales del21/28oct y4nov, correctivos distribuidos entre22oct y6nov, lecturas de salida/llegada, novedades vinculadas a jornada, intervenciones, actividades, consumos y movimientos. La orden manual anterior del3nov conserva su creación/asignación y continúa con ejecución y cierre simulados.

## Operación posterior y límites

La versión productiva `0a68f08` corrige el HTTP500/P2028 que apareció en restricciones preventivas al evaluar el escenario completo. Vercel y Render quedaron sincronizados. Verificación nueva:292/292 pruebas backend,6/6 del plan,23/23 comprobaciones de API productiva por roles y10 controles de coherencia; revisión de181 fragmentos de logs del release sin indicadores de error. La salud de una solicitud aislada no es un SLA: algunas consultas productivas medidas tardaron4–8segundos.

Esta entrega actualiza un corte; **no instala un simulador diario automático**. La planificación futura sigue separada de la ejecución. Para mantenerla al día, operar las jornadas y órdenes por los roles normales o preparar un nuevo lote incremental, con inventario y respaldo actuales. No volver a ejecutar un seed general ni mover todas las fechas.

La herramienta reproducible está en [scripts/demo-continuidad](../scripts/demo-continuidad/README.md). El respaldo, plan, SQL generado y recibos detallados son privados y permanecen fuera del repositorio y del ZIP de código. Las verificaciones API utilizan sesiones efímeras de diagnóstico; no acreditan login por contraseña, revisión visual en navegador o prueba de medios externos.
