# P14 — Demo reproducible

## Condiciones

- Producto: prototipo web académico con datos simulados.
- URL: <https://v0-bus-fleet-management-neon.vercel.app>.
- Usar las cuatro cuentas demo y la contraseña almacenada como `SGMV_PROD_TEST_PASSWORD`; nunca copiarla al guion.
- Abrir una sesión privada/incógnito por rol o cerrar sesión entre pasos.
- Si Render estaba inactivo, abrir `/api/ready` y esperar HTTP 200 antes de iniciar.
- No crear, borrar ni recrear datos productivos durante la sustentación.

## Recorrido completo

| Paso | Rol | Pantalla/acción | Dato simulado | Resultado esperado | Requisito | Continúa |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Despachador | Inicia sesión y abre RF-01 Jornadas | BUS-001 y jornada demo | Ve asignación, conductor, horario, ruta y estado operativo | RF-01 | Conductor |
| 2 | Conductor | Abre Mi jornada | Su jornada derivada de sesión | Solo ve su bus/jornada y kilometraje permitido | RF-01, RNF-01 | Conductor |
| 3 | Conductor | Abre RF-02 Novedades | Novedad demo de vibración/frenado | Ve el reporte asociado a su contexto, con seguimiento autorizado | RF-02 | Despachador |
| 4 | Despachador | Abre RF-02 Novedades | La misma novedad | Ve impacto operativo, sin acciones de cierre técnico | RF-02, RNF-01 | Administrador |
| 5 | Administrador | Abre RF-03 Preventivo | Plan/programación demo | Ve estado vigente/próximo/vencido, objetivos y generación controlada de orden | RF-03 | Administrador |
| 6 | Administrador | Abre RF-04 Órdenes | OT-DEMO-CORR-001 u orden demo vigente | Ve estado, asignación y costos autorizados | RF-04, RNF-01 | Mecánico |
| 7 | Mecánico | Abre RF-04 Órdenes | Sus órdenes asignadas | Ve diagnóstico/actividad técnica, pero no columna, filtro, subtotal, precio ni costo total | RF-04, RNF-01 | Mecánico |
| 8 | Mecánico | Abre RF-06 Historial | BUS-001 | Consulta antecedentes técnicos necesarios sin economía administrativa | RF-06, RNF-01 | Administrador |
| 9 | Administrador | Abre RF-05 Repuestos | Repuesto demo compatible | Ve stock, compatibilidad, movimientos y costo autorizado | RF-05 | Mecánico |
| 10 | Mecánico | Abre Alertas | Bandeja propia | Ve solo alertas destinadas a su usuario/rol y puede observar estado | RNF-05 | Administrador |
| 11 | Administrador | Abre RF-06 Historial e informes | BUS-001 | Reconstruye jornada → kilometraje → novedad → orden → intervención → consumo → disponibilidad | RF-06 | Fin |

Las mutaciones completas ya están cubiertas por pruebas automatizadas. Para una sustentación segura se recomienda demostrar principalmente consultas sobre los datos simulados existentes.

## Versión corta para sustentación — 6 a 8 minutos

1. **Despachador, 1 min:** RF-01 Jornadas y estado operativo de BUS-001.
2. **Conductor, 1 min:** Mi jornada y RF-02 Novedades propias.
3. **Administrador, 2 min:** RF-03 Preventivo, RF-04 orden y costo autorizado.
4. **Mecánico, 2 min:** RF-04 misma orden, demostrar que no existen costos, y abrir historial técnico.
5. **Administrador, 1 min:** RF-05 Repuestos y RF-06 trazabilidad integral.
6. **Cierre, 1 min:** Alertas internas por destinatario, manifest P14 y resultados del Gate.

## Recuperación durante la demo

- **Cold start:** esperar `/api/ready` 200 y recargar una sola vez.
- **Sesión equivocada:** cerrar sesión y usar una ventana privada por rol.
- **Sin datos en un filtro:** pulsar `Limpiar` y usar los códigos demo indicados.
- **No mutar:** si una acción de alta/cierre no es necesaria para explicar el flujo, mostrar su prueba automatizada y evidencia en la matriz.
- **Error real:** no ocultarlo; registrar hora, rol, ruta y request ID y aplicar el runbook de `INVENTARIO_FINAL.md`.
