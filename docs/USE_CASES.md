# Casos de uso principales

## 1. Regla general

El diagrama/generalización funcional del sistema se mantiene en **seis casos de uso principales**, alineados con los seis RF.

No convertir acciones genéricas como iniciar sesión, cerrar sesión, guardar, buscar o filtrar en casos de uso principales.

### Precondición general

Para ejecutar funciones protegidas, el actor debe estar autenticado y autorizado según su rol.

---

# CU-01 — Gestionar flota vehicular

**RF relacionado:** RF-01  
**Actor principal:** Administrador / Supervisor  
**Actor secundario:** Conductor / Operador, consulta limitada

## Objetivo

Mantener centralizada la información operativa básica de los buses y sus asignaciones.

## Flujo principal — Administrador

1. Accede al módulo de flota.
2. Consulta la lista de buses.
3. Registra o selecciona un bus.
4. Consulta/actualiza datos permitidos.
5. Actualiza kilometraje o estado cuando corresponda.
6. Gestiona la asignación de conductor.
7. El sistema valida datos.
8. El sistema persiste los cambios y conserva trazabilidad.

## Flujo de consulta — Conductor

1. Ingresa a su vista.
2. El sistema identifica su asignación.
3. Muestra únicamente el bus permitido.
4. Muestra datos básicos/estado/próximo mantenimiento permitido.

## Alternativas

- Datos duplicados → rechazar.
- Conductor sin bus asignado → mostrar estado informativo sin exponer otros buses.
- Acceso a bus ajeno → 403/denegado.

## Postcondición

La información de flota queda actualizada y trazable.

---

# CU-02 — Gestionar novedades y fallas

**RF relacionado:** RF-02  
**Actor principal inicial:** Conductor / Operador  
**Actor de gestión:** Administrador / Supervisor

## Objetivo

Crear un canal estructurado y trazable para reportar fallas detectadas durante la operación.

## Flujo principal

1. Conductor abre formulario de novedad.
2. El sistema identifica usuario y bus asignado.
3. Conductor selecciona tipo.
4. Registra descripción.
5. Envía.
6. El sistema registra autor, bus y fecha.
7. Administrador consulta novedades pendientes.
8. Revisa y clasifica.
9. Decide:
   - resolver/cerrar la novedad sin orden; o
   - descartarla con trazabilidad; o
   - convertirla en orden correctiva.
10. Si crea una orden, el sistema conserva la relación.
11. El conductor puede consultar el estado de su reporte.

## Alternativas

- Conductor sin asignación → no permitir reporte asociado a un bus desconocido.
- Datos obligatorios incompletos → rechazar.
- Intento de consultar novedad ajena → denegar.
- Conversión ya realizada → impedir duplicación accidental.

## Postcondición

La novedad queda trazada hasta su resolución o hasta la orden originada.

---

# CU-03 — Gestionar mantenimiento preventivo

**RF relacionado:** RF-03  
**Actor principal:** Administrador / Supervisor  
**Actor secundario:** Sistema

## Objetivo

Programar y controlar mantenimiento preventivo usando fecha y/o kilometraje.

## Flujo principal

1. Administrador selecciona un bus.
2. Registra actividad preventiva.
3. Define criterio:
   - fecha;
   - kilometraje;
   - ambos.
4. Guarda programación.
5. El sistema evalúa las condiciones al consultar/actualizar datos relevantes.
6. El sistema muestra estado de seguimiento.
7. Administrador decide generar orden preventiva cuando corresponda.
8. El sistema crea la orden con origen preventivo.
9. Conserva relación programación → orden.

## Alternativas

- Fecha/kilometraje inválido → rechazar.
- Programación ya convertida → no duplicar orden.
- Cambio de programación → conservar trazabilidad relevante.

## Postcondición

Existe programación válida y, si corresponde, una orden preventiva relacionada.

---

# CU-04 — Gestionar órdenes de trabajo y mantenimiento correctivo

**RF relacionado:** RF-04  
**Actores:** Administrador / Supervisor; Personal Técnico / Mecánico

## Objetivo

Controlar de extremo a extremo la ejecución de una intervención de mantenimiento.

## Entradas posibles

- Orden correctiva creada directamente.
- Orden originada por novedad.
- Orden originada por programación preventiva.

## Flujo principal

1. Administrador crea/recibe una orden.
2. Verifica bus, origen, descripción/prioridad y demás datos requeridos.
3. Asigna un Mecánico.
4. Mecánico consulta sus órdenes.
5. Abre la orden.
6. Consulta antecedentes del bus.
7. Inicia la ejecución.
8. Registra diagnóstico.
9. Registra actividades realizadas.
10. Registra observaciones.
11. Registra repuestos consumidos cuando aplique.
12. Marca el trabajo como completado.
13. Administrador revisa.
14. Si la información es válida, cierra la orden.
15. El sistema registra responsable y fecha.
16. La información queda disponible en el historial.

## Alternativas

- Mecánico intenta abrir orden ajena → denegar salvo regla autorizada.
- Transición de estado inválida → rechazar.
- Cierre sin información técnica mínima → rechazar.
- Stock insuficiente → no registrar consumo inconsistente.
- Supervisor devuelve trabajo para corrección → conservar estado/trazabilidad según la máquina de estados aprobada.

## Postcondición

Orden cerrada de manera trazable y reflejada en historial.

---

# CU-05 — Gestionar repuestos e insumos

**RF relacionado:** RF-05  
**Actores:** Administrador / Supervisor; Personal Técnico / Mecánico

## Objetivo

Mantener un inventario básico y vincular los consumos con las intervenciones.

## Flujo principal — Administración

1. Administrador consulta catálogo.
2. Registra/actualiza un repuesto.
3. Registra entrada o ajuste.
4. El sistema valida cantidad.
5. Registra movimiento, fecha y responsable.
6. Actualiza existencia.

## Flujo principal — Consumo técnico

1. Mecánico abre una orden activa permitida.
2. Consulta disponibilidad.
3. Selecciona repuesto.
4. Registra cantidad utilizada.
5. El sistema valida stock.
6. Registra consumo.
7. Actualiza stock de forma atómica.
8. Mantiene relación consumo → orden → repuesto.

## Alternativas

- Cantidad <= 0 → rechazar.
- Stock insuficiente → rechazar o aplicar la política explícitamente aprobada; nunca producir stock inconsistente.
- Mecánico intenta ajuste administrativo → denegar.

## Postcondición

Existencias y movimientos permanecen consistentes y trazables.

---

# CU-06 — Consultar historial y generar informes

**RF relacionado:** RF-06  
**Actores:** Administrador / Supervisor; Personal Técnico / Mecánico; Conductor / Operador limitado

## Objetivo

Consultar antecedentes de mantenimiento y generar información de seguimiento sin analítica predictiva.

## Flujo — Administrador/Supervisor

1. Abre historial o informes.
2. Selecciona filtros.
3. Como mínimo puede filtrar por:
   - bus;
   - período;
   - tipo de intervención.
4. El sistema consulta información relacionada.
5. Muestra resultados coherentes.
6. Puede visualizar costos básicos cuando corresponda.

## Flujo — Mecánico

1. Consulta historial técnico permitido.
2. Utiliza antecedentes para atender una orden.

## Flujo — Conductor

1. El sistema identifica su bus.
2. Muestra únicamente resumen autorizado.
3. No muestra costos, inventario ni datos de otros buses.

## Alternativas

- Filtro sin resultados → mostrar resultado vacío controlado.
- Acceso no autorizado → denegar.
- Datos históricos incompletos → mostrar únicamente información existente, sin inventar registros.

## Postcondición

La consulta no modifica historial y respeta permisos.
