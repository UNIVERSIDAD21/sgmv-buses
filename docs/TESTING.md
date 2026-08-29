# Testing y validación

## 1. Objetivo

Demostrar que los seis RF operan de extremo a extremo y que los cuatro RNF se cumplen en el entorno de prueba.

Combinar:

- pruebas unitarias donde aporten valor;
- pruebas de integración de API/datos;
- pruebas funcionales/caja negra;
- pruebas manuales de interfaz para flujos críticos.

---

# 2. Casos funcionales mínimos

## T-RF01-01 — Registrar bus

**Entrada:** datos válidos.
**Esperado:** bus persistido con identificación única.

## T-RF01-02 — Duplicado

**Entrada:** placa/código duplicado.
**Esperado:** rechazo controlado.

## T-RF01-03 — Acceso conductor

**Entrada:** conductor solicita bus ajeno por API.
**Esperado:** 403/denegado, sin fuga de datos.

## T-RF01-04 — Asignación

**Esperado:** asignacion activa identificable e historial preservado. Un conductor no puede tener mas de un bus activo y un bus no puede tener mas de un conductor activo.

---

## T-RF02-01 — Registrar novedad

**Actor:** Conductor.
**Esperado:** autor/bus/fecha se asocian correctamente.

## T-RF02-02 — Consultar propias

**Esperado:** solo sus reportes.

## T-RF02-03 — Convertir a orden

**Esperado:** orden creada una vez y relación preservada.

---

## T-RF03-01 — Preventivo por fecha

**Esperado:** calculo de condicion coherente con umbral aprobado de 7 dias.

## T-RF03-02 — Preventivo por kilometraje

**Esperado:** condicion coherente con kilometraje actual y umbral aprobado de 500 km.

## T-RF03-03 — Preventivo combinado

**Esperado:** regla documentada y resultado reproducible.

## T-RF03-04 — Generar orden

**Esperado:** origen preventivo y relación preservada; sin duplicado.

## T-RF03-05 — Limite con cierre preventivo

**Esperado:** RF-03 genera la orden preventiva, pero no la ejecuta ni la cierra. La actualizacion de la proxima fecha o kilometraje al cerrar una orden preventiva se valida en RF-04.

---

## T-RF04-01 — Orden directa

**Esperado:** administrador crea y asigna.

## T-RF04-02 — Mecánico atiende

**Esperado:** registra diagnóstico/actividades/observaciones.

## T-RF04-03 — Transición inválida

**Esperado:** rechazo. No se permite cerrar desde `ASIGNADA` ni `EN_EJECUCION`; `CERRADA` es terminal.

## T-RF04-04 — Cierre incompleto

**Esperado:** rechazo si faltan fechas de ejecucion o actividades realizadas. En orden correctiva, rechazo si falta diagnostico.

## T-RF04-05 — Cierre válido

**Esperado:** administrador cierra, fecha/responsable registrados, historial disponible.

## T-RF04-06 — Reasignacion auditada

**Esperado:** solo Administrador puede reasignar mecanico y queda registro de responsable/fecha.

---

## T-RF05-01 — Entrada inventario

**Esperado:** stock y movimiento coherentes.

## T-RF05-02 — Ajuste por admin

**Esperado:** autorizado y trazado.

## T-RF05-03 — Ajuste por mecánico

**Esperado:** denegado.

## T-RF05-04 — Consumo

**Esperado:** consumo + movimiento + descuento en una transacción.

## T-RF05-05 — Fallo transacción

**Esperado:** ningún cambio parcial.

## T-RF05-06 — Stock insuficiente

**Esperado:** no producir stock inconsistente.

---

## T-RF06-01 — Historial administrador

**Esperado:** datos completos autorizados.

## T-RF06-02 — Historial mecánico

**Esperado:** antecedentes técnicos permitidos.

## T-RF06-03 — Historial conductor

**Esperado:** solo su bus y resumen permitido; sin costos.

## T-RF06-04 — Informe por filtros

**Esperado:** bus/período/tipo producen datos coherentes.

---

# 3. Casos no funcionales

## T-RNF01 — Seguridad

Verificar:

- hash de contraseña;
- cuenta inactiva;
- JWT con expiracion definida;
- cookie `HttpOnly`;
- `Secure=true` en produccion;
- `SameSite` segun entorno;
- CORS restringido al frontend autorizado;
- proteccion CSRF o validacion equivalente en escrituras;
- limite de intentos de inicio de sesion;
- logs sin contrasenas, hashes ni tokens;
- autorización por rol en API;
- conductor intentando recursos ajenos;
- validación backend;
- no exponer stack/secrets;
- FK/UNIQUE;
- trazabilidad responsable/fecha.

---

## T-RNF02 — Usabilidad

Verificar manualmente:

- navegación coherente;
- terminología consistente;
- formularios comprensibles;
- layout usable en resoluciones objetivo;
- Chrome;
- Edge.

---

## T-RNF03 — Desempeño

En el entorno de prueba definido:

- medir operaciones habituales;
- objetivo: 95 % <= aproximadamente 3 s;
- registrar entorno, volumen de datos y método de medición para que el resultado tenga contexto.

No prometer capacidad empresarial a partir de esta prueba.

---

## T-RNF04 — Mantenibilidad

Revisión técnica:

- separación frontend/backend/datos;
- módulos identificables;
- secretos fuera de código;
- ausencia de archivos monolíticos injustificados;
- código con nombres claros;
- decisiones técnicas documentadas.

---

# 4. Flujos E2E obligatorios

## E2E-01 — Novedad correctiva

Conductor → reporta → Administrador → convierte → asigna → Mecánico → ejecuta → Administrador → cierra → historial → Conductor consulta estado.

## E2E-02 — Preventivo

Administrador → programa → sistema detecta condicion con umbral 7 dias/500 km → genera orden sin duplicar activas → Mecanico → ejecuta → Administrador → cierra → actualiza proximo objetivo preventivo → historial.

Cobertura RF-03 cerrada: hasta `genera orden sin duplicar activas`. RF-04 agrega ejecucion por Mecanico y cierre administrativo; la actualizacion automatica de proximo objetivo no se ejecuta porque el modelo fisico no contiene intervalos preventivos aprobados.

## E2E-03 — Repuesto

Orden activa → Mecánico consume → inventario descuenta → movimiento queda trazado → informe/historial refleja datos permitidos.

## E2E-04 — Autenticacion y cookie

Login valido → cookie `HttpOnly` emitida → escritura protegida por CSRF o equivalente → logout limpia sesion → acceso posterior rechazado.

## E2E-05 — Despliegue

Frontend en Vercel → consume API en Render → API usa Neon → CORS/cookies funcionan solo desde el dominio autorizado → smoke test aprobado.

---

# 5. Registro de resultados

Para la evidencia académica, registrar:

| ID | Módulo | Escenario | Entrada | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|---|---|---|

Estados:

- APROBADO
- FALLIDO
- PENDIENTE DE AJUSTE

Los errores bloqueantes de los flujos principales deben corregirse antes del cierre del prototipo.

---

## 6. Evidencia del bloque de Persistencia

El 2026-08-26 se agregaron y ampliaron pruebas automatizadas de integridad para el modelo Prisma/PostgreSQL:

- Asignacion activa unica por conductor y por bus.
- Novedad convertida a una sola orden y coherencia de `origen = NOVEDAD`.
- Programacion preventiva con varias ordenes historicas y maximo una activa.
- Consumo de repuestos mediante `ConsumoRepuesto` y movimiento de inventario trazable.
- Ausencia de campos directos redundantes `ordenTrabajoId` en `MovimientoInventario` y `repuestoId` en `OrdenTrabajo`.
- Rechazo de orden originada por novedad de otro bus.
- Rechazo de orden preventiva asociada a programacion de otro bus.
- Rechazo de movimiento de consumo con repuesto distinto al consumo.
- Rechazo de consumos sin movimiento tipo `CONSUMO`.
- Rechazo de subtotales manipulados.
- Fechas cronologicas de orden y `CERRADA` terminal.
- Motivo obligatorio para entradas y ajustes administrativos.
- Normalizacion de correo, placas y codigos.
- Patron transaccional para impedir stock negativo y cambios parciales.

Comando ejecutado:

```bash
npm --workspace @sgmv/backend run test
```

Resultado: 2 archivos de prueba aprobados, 9 pruebas aprobadas.

Validacion adicional del bloque:

- Migraciones aplicadas desde cero en schema temporal de Neon.
- Seed ejecutado en ese schema temporal con `SEED_USER_PASSWORD` de proceso.
- Pruebas ejecutadas contra ese schema temporal.
- Schema temporal eliminado al finalizar.
- Auditoria SQL final en Neon actual con cero inconsistencias en coherencia bus-orden, consumo-movimiento, subtotal, `costoTotal`, motivos administrativos, fechas y normalizacion.

---

## 7. Evidencia de RF-01 - Gestion de la flota vehicular

El 2026-08-27 se agregaron pruebas automatizadas de RF-01.

Backend `src/backend/test/fleet.test.ts` cubre:

- autenticacion obligatoria;
- permisos de Administrador, Conductor y Mecanico;
- registro valido de bus;
- duplicado de placa;
- duplicado de codigo interno;
- duplicados por diferencias de mayusculas/minusculas;
- listado con busqueda, filtro y paginacion;
- edicion valida;
- estado invalido;
- kilometraje inferior al actual;
- registro atomico de kilometraje e historial;
- cambio de estado e historial;
- asignacion valida;
- conductor con asignacion activa;
- bus con asignacion activa;
- reasignacion y cierre de asignaciones anteriores;
- conservacion de historiales;
- consulta del bus asignado;
- conductor intentando consultar otro bus;
- mecanico intentando acceder a RF-01;
- rollback cuando falla una operacion transaccional.

Frontend `src/frontend/src/App.test.tsx` cubre:

- carga del listado;
- busqueda;
- filtro;
- paginacion;
- registro;
- edicion;
- validaciones frontend;
- error de duplicado del backend;
- registro de kilometraje;
- cambio de estado;
- asignacion/reasignacion desde la interfaz;
- estados de carga, vacio y error;
- acciones visibles segun rol;
- conductor con bus asignado;
- conductor sin bus asignado;
- mecanico sin acceso a RF-01.

Evidencia visual:

- `docs/screenshots/rf01-flota-listado-1440x900.png`
- `docs/screenshots/rf01-flota-listado-1024x768.png`
- `docs/screenshots/rf01-flota-listado-390x844.png`
- `docs/screenshots/rf01-bus-formulario-1440.png`
- `docs/screenshots/rf01-bus-detalle-1440.png`
- `docs/screenshots/rf01-kilometraje-1440.png`
- `docs/screenshots/rf01-cambio-estado-1440.png`
- `docs/screenshots/rf01-asignacion-conductor-1440.png`
- `docs/screenshots/rf01-vista-conductor-390.png`

Playwright verifico `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina, con tablas desplazables en movil, formularios legibles, modales/drawers accesibles y foco alcanzable por teclado.

---

## 8. Evidencia de RF-02 - Control de novedades operativas

El 2026-08-27 se agregaron pruebas automatizadas de RF-02.

Backend `src/backend/test/novelty.test.ts` cubre:

- autenticacion obligatoria;
- permisos de Administrador, Conductor y Mecanico;
- conductor con asignacion activa;
- conductor sin asignacion activa;
- bus derivado de la asignacion;
- autor derivado de la sesion;
- intento de suplantar autor o bus;
- consulta de novedades propias;
- intento de consultar una novedad ajena;
- administrador consultando todas;
- validaciones de campos;
- transiciones validas;
- transiciones invalidas;
- proteccion de estados terminales;
- conversion valida en orden;
- orden correctiva con el mismo bus;
- estado inicial e historial de la orden;
- intento de conversion duplicada;
- solicitudes concurrentes;
- rollback de toda la transaccion si falla una parte.

Frontend `src/frontend/src/App.test.tsx` cubre:

- formulario del Conductor;
- Conductor sin bus asignado;
- envio valido;
- validaciones frontend;
- prevencion de doble envio;
- listado propio;
- detalle autorizado;
- listado administrativo;
- busqueda y filtros;
- revision;
- cambio de estado mediante acciones controladas;
- conversion en orden;
- orden generada como resumen;
- acciones visibles segun rol;
- Mecanico sin acceso;
- estados de carga, vacio y error.

Evidencia visual:

- `docs/screenshots/rf02-driver-form-1440x900.png`
- `docs/screenshots/rf02-driver-list-1440x900.png`
- `docs/screenshots/rf02-novelty-detail-1440x900.png`
- `docs/screenshots/rf02-admin-panel-1440x900.png`
- `docs/screenshots/rf02-admin-filters-1024x768.png`
- `docs/screenshots/rf02-review-dialog-1440x900.png`
- `docs/screenshots/rf02-convert-dialog-1440x900.png`
- `docs/screenshots/rf02-order-generated-1440x900.png`
- `docs/screenshots/rf02-mobile-390x844.png`

Playwright verifico `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina, con tablas desplazables en movil, formularios legibles, dialogos/drawers accesibles y foco alcanzable por teclado.

---

## 9. Evidencia de normalizacion transversal de roles

El 2026-08-27 se agregaron y actualizaron pruebas automatizadas para demostrar el catalogo canonico de roles.

Backend:

- `src/backend/test/auth.test.ts` valida que solo existan `ADMINISTRADOR`, `CONDUCTOR` y `MECANICO` en la tabla `roles`.
- `src/backend/test/auth.test.ts` rechaza sesiones firmadas con alias heredados como `SUPERVISOR`, `OPERADOR`, `OPERARIO`, `TECNICO`, `ADMIN_SUPERVISOR` y `CONDUCTOR_OPERADOR`.
- `src/backend/test/fleet.test.ts` mantiene permisos de Administrador, Conductor y Mecanico para RF-01.
- `src/backend/test/novelty.test.ts` mantiene permisos de Administrador, Conductor y Mecanico para RF-02.
- `src/backend/test/prisma-integrity.test.ts` usa seeds/fixtures con los roles canonicos.

Frontend:

- `src/frontend/src/App.test.tsx` valida que las etiquetas visibles usen Administrador, Conductor y Mecánico.
- `src/frontend/src/App.test.tsx` valida que no aparezcan etiquetas compuestas con barra en roles visibles.
- Las pruebas de RF-01 y RF-02 continuan cubriendo acciones visibles segun rol, conductor limitado y mecanico sin acceso a RF-02.

Evidencia visual:

- `docs/screenshots/roles-normalizacion-admin-1440x900.png`
- `docs/screenshots/roles-normalizacion-conductor-390x844.png`

---

## 10. Evidencia de RF-03 - Administracion del mantenimiento preventivo

El 2026-08-27 se agregaron pruebas automatizadas para RF-03.

Backend:

- `src/backend/test/preventive.test.ts` cubre autenticacion obligatoria, Administrador autorizado, Conductor/Mecanico denegados, usuario inactivo denegado y alias heredados rechazados.
- Cubre creacion valida por fecha, kilometraje y criterio combinado.
- Cubre rechazo de programacion sin criterio aplicable, bus inexistente, bus inactivo, campos internos desconocidos, fecha invalida, kilometraje invalido y duplicados logicos.
- Cubre clasificacion deterministica con reloj controlado para 8/7/1/0/-1 dias y 501/500/1/0/superado km.
- Cubre resumen, listado paginado, busqueda, filtros, detalle y DTO sin campos sensibles.
- Cubre reprogramacion controlada, rechazo de campos protegidos y bloqueo cuando existe orden activa.
- Cubre generacion de orden preventiva proxima/vencida, rechazo de vigente, mismo bus, origen `PREVENTIVO`, tipo `PREVENTIVA`, estado `PENDIENTE_ASIGNACION`, sin Mecanico asignado, historial inicial, responsable de sesion, orden ya existente, concurrencia e inexistencia de huerfanos.

Frontend:

- `src/frontend/src/App.test.tsx` cubre ruta protegida, Administrador con acceso, Conductor/Mecanico denegados, resumen real, listado, paginacion, busqueda, filtros, estados vacio/error, formularios por fecha/kilometraje/combinado, validacion sin criterio, doble envio, detalle, badges, valores restantes, reprogramacion y generacion de orden.

Evidencia visual:

- `docs/screenshots/rf03-summary-1440x900.png`
- `docs/screenshots/rf03-list-1440x900.png`
- `docs/screenshots/rf03-filters-1024x768.png`
- `docs/screenshots/rf03-form-date-1440x900.png`
- `docs/screenshots/rf03-form-combined-1440x900.png`
- `docs/screenshots/rf03-detail-vigente-1440x900.png`
- `docs/screenshots/rf03-detail-proximo-1440x900.png`
- `docs/screenshots/rf03-detail-vencido-1440x900.png`
- `docs/screenshots/rf03-generate-order-confirm-1440x900.png`
- `docs/screenshots/rf03-order-generated-1440x900.png`
- `docs/screenshots/rf03-mobile-390x844.png`
- `docs/screenshots/rf03-mobile-list-390x844.png`

La verificacion visual confirmo `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina, sin contenido cortado, con controles diferenciables sin depender solo del color y dialogos/drawers accesibles.

---

## 11. Evidencia de RF-04 - Seguimiento de ordenes de trabajo

El 2026-08-28 se agregaron pruebas automatizadas para RF-04.

Backend:

- `src/backend/test/work-order.test.ts` cubre autenticacion obligatoria, Administrador autorizado, Mecanico limitado a sus ordenes, Conductor denegado, usuario inactivo denegado y alias heredados rechazados.
- Cubre orden correctiva de RF-02 y preventiva de RF-03 disponibles en RF-04, con novedad/programacion, bus y objetivos preventivos conservados.
- Cubre creacion manual correctiva, rechazo de campos protegidos y rechazo de preventiva manual no soportada por el modelo fisico.
- Cubre resumen, listado, mis ordenes, busqueda, filtros por estado/tipo/origen/bus/mecanico, detalle, historial y DTO seguros.
- Cubre asignacion, mecanico inexistente, usuario sin rol, usuario inactivo, estado invalido, reasignacion, mismo mecanico rechazado, motivo obligatorio, `orden_reasignaciones` y perdida inmediata de permisos del mecanico anterior.
- Cubre inicio, intervencion, diagnostico, observaciones, actividad valida, actividad vacia rechazada, escritura fuera de ejecucion rechazada y correccion despues de devolucion sin borrar historial.
- Cubre consumo con repuesto activo, inactivo, stock insuficiente, cantidad invalida, mecanico ajeno, descuento correcto, movimiento unico, relaciones, costo del servidor, subtotal decimal, costo total, rollback, concurrencia e idempotencia.
- Cubre completado tecnico, precondiciones, escritura bloqueada despues de completar, devolucion, reanudacion, cierre administrativo, historial final, costo validado, orden cerrada terminal y preventiva sin crear programacion nueva.

Frontend:

- `src/frontend/src/App.test.tsx` cubre Administrador con resumen, listado, filtros, creacion manual, asignacion, reasignacion, devolucion y cierre con confirmacion.
- Cubre Mecanico con listado propio, detalle, inicio, diagnostico, observaciones, actividades, disponibilidad, consumo y completado tecnico.
- Cubre Conductor denegado y navegacion RF-02 intacta.

Evidencia visual:

- `docs/screenshots/rf04-admin-summary-1440x900.png`
- `docs/screenshots/rf04-admin-list-filters-1024x768.png`
- `docs/screenshots/rf04-admin-create-1440x900.png`
- `docs/screenshots/rf04-admin-detail-pending-1440x900.png`
- `docs/screenshots/rf04-admin-assign-1440x900.png`
- `docs/screenshots/rf04-admin-reassign-1440x900.png`
- `docs/screenshots/rf04-admin-completed-1440x900.png`
- `docs/screenshots/rf04-admin-return-dialog-1440x900.png`
- `docs/screenshots/rf04-admin-close-dialog-1440x900.png`
- `docs/screenshots/rf04-admin-closed-1440x900.png`
- `docs/screenshots/rf04-mechanic-list-1440x900.png`
- `docs/screenshots/rf04-mechanic-detail-assigned-1440x900.png`
- `docs/screenshots/rf04-mechanic-execution-1440x900.png`
- `docs/screenshots/rf04-mechanic-technical-1440x900.png`
- `docs/screenshots/rf04-mechanic-consumption-1440x900.png`
- `docs/screenshots/rf04-mechanic-consumption-summary-1440x900.png`
- `docs/screenshots/rf04-mechanic-completed-1440x900.png`
- `docs/screenshots/rf04-mechanic-returned-1440x900.png`
- `docs/screenshots/rf04-mechanic-mobile-390x844.png`

La verificacion visual RF-04 confirma `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina, tablas adaptables, controles por rol/estado, dialogos accesibles y foco visible.

---

## 12. Evidencia de RF-05 - Central de repuestos

El 2026-08-29 se agregaron pruebas automatizadas para RF-05.

Backend:

- `src/backend/test/spare-part.test.ts` cubre autenticacion obligatoria, Administrador autorizado, Mecanico y Conductor denegados, catalogo, creacion con stock cero, creacion con stock inicial y movimiento, normalizacion, duplicados, detalle, edicion controlada, rechazo de stock por `PATCH`, activacion/desactivacion, inactivos, clasificacion, listado, filtros, entradas, ajustes, idempotencia y concurrencia.
- Cubre entradas concurrentes sin actualizacion perdida, ajustes negativos concurrentes con stock limitado, consumo RF-04 concurrente contra ajuste RF-05, alta concurrente con mismo codigo y cero stock negativo.
- Cubre integracion RF-04: consumo descuenta stock, genera un solo movimiento `CONSUMO`, aparece en movimientos RF-05 con referencia a orden/consumo y conserva costo historico aunque cambie el costo actual del repuesto.
- `src/backend/test/work-order.test.ts` conserva consumo transaccional de RF-04 y valida consulta minima de repuestos activos con stock positivo.
- `src/backend/test/prisma-integrity.test.ts` conserva restricciones de consumo, movimiento, subtotales, motivos administrativos y stock no negativo.

Frontend:

- `src/frontend/src/App.test.tsx` cubre ruta `/repuestos`, navegacion visible solo para Administrador, guard de ruta para Mecanico y Conductor, resumen real, catalogo, busqueda, filtros, estados vacio/error, formulario de creacion, validaciones, codigo duplicado, stock inicial, detalle, edicion sin stock directo, entrada, ajuste positivo, ajuste negativo con confirmacion, stock insuficiente, activacion/desactivacion, doble envio bloqueado e historial con referencia a `OT-RF04-001`.

Conteos ejecutados:

- Frontend completo: 42/42.
- Backend por archivo contra PostgreSQL/Neon configurado: 80/80.
- Backend RF-05 aislado: 11/11.
- Backend RF-05 en Neon temporal `rf05_final_20260829_1627`: 11/11.
- Seed temporal RF-05 ejecutado dos veces: 3 roles, 4 usuarios, 2 buses, 1 novedad, 1 programacion, 2 ordenes, 4 repuestos, 1 consumo y 5 movimientos.
- Auditoria temporal RF-05: 0 inconsistencias en codigos duplicados, stock negativo, movimientos sin repuesto, consumos sin repuesto, consumos sin movimiento, consumos con mas de un movimiento, movimientos `CONSUMO` sin consumo, consumos con orden inexistente y responsables inexistentes.

Evidencia visual requerida:

- `docs/screenshots/rf05-inventory-list-1440x900.png`
- `docs/screenshots/rf05-part-form-1440x900.png`
- `docs/screenshots/rf05-part-detail-1440x900.png`
- `docs/screenshots/rf05-stock-entry-1440x900.png`
- `docs/screenshots/rf05-stock-adjustment-1440x900.png`
- `docs/screenshots/rf05-movements-1440x900.png`
- `docs/screenshots/rf05-low-stock-1024x768.png`
- `docs/screenshots/rf05-mobile-390x844.png`
- `docs/screenshots/rf05-rf04-consumption-movement-1440x900.png`

La verificacion visual RF-05 confirmo `1440x900`, `1024x768` y `390x844` sin overflow horizontal de pagina, estados visibles por texto, formularios utilizables, drawers accesibles, filtros funcionales y consola del navegador sin errores relevantes distintos de los `401` esperados de recuperacion de sesion antes del login.

---

## 13. Neon y ejecucion secuencial de pruebas backend

El script backend usa:

```text
vitest --run --fileParallelism=false
```

Ese cambio secuencia archivos o suites de Vitest para no saturar el pool de conexiones contra Neon. No convierte en secuenciales las solicitudes internas de una prueba especifica.

Las pruebas de concurrencia RF-02, RF-03 y RF-04 conservan solicitudes simultaneas mediante `Promise.all`. En RF-02 se valida que dos solicitudes simultaneas para convertir la misma novedad no generen dos ordenes, que solo una respuesta represente creacion nueva, que la base termine con una sola orden asociada, que exista un unico historial inicial valido y que no queden transacciones parciales. En RF-03 se valida el mismo principio para generar una orden preventiva desde una programacion. En RF-04 se valida consumo con stock limitado, asignacion incompatible, completado/cierre simultaneo y doble cierre.

`P1001` debe tratarse como limitacion de conexion con Neon o su pooler cuando no se puede establecer comunicacion. No representa por si solo una prueba funcional fallida.

Durante la validacion temporal de RF-04 se registro un primer intento con `P1002` al adquirir el advisory lock de Prisma para migraciones. Se repitio en el schema temporal `rf04_final_20260828_1710` con `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1`, sin ejecutar migraciones simultaneas sobre el mismo schema; las 6 migraciones aplicaron desde cero, el seed corrio dos veces, RF-04 backend paso `11/11` y el schema fue eliminado al finalizar.

Durante la validacion temporal de RF-05 se repitio la mitigacion documentada para Neon: `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` solo en migraciones secuenciales del schema temporal `rf05_final_20260829_1627`. Las 7 migraciones aplicaron desde cero, el seed corrio dos veces, RF-05 backend paso `11/11`, la auditoria de integridad quedo en cero inconsistencias y el schema fue eliminado al finalizar.

RF-05 tambien corrigio una incompatibilidad de lecturas con el pooler: el resumen y catalogo dejaron de usar SQL crudo para evitar `cached plan must not change result type` al validar schemas temporales. Los filtros, conteos, ordenamiento y paginacion quedaron implementados con Prisma query builder.

`P1002` indica tiempo de espera agotado. Si el mensaje menciona advisory lock, el contexto especifico es bloqueo/espera de migracion; no todos los `P1002` significan la misma causa.

Las migraciones no deben ejecutarse simultaneamente sobre el mismo schema. Las validaciones desde cero o de actualizacion deben usar schemas temporales independientes y nunca registrar secretos ni cadenas de conexion.
