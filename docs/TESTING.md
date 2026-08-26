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

## T-RF03-05 — Cierre preventivo y nuevo objetivo

**Esperado:** al cerrar una orden preventiva, se actualiza la proxima fecha o el proximo kilometraje objetivo antes de permitir una nueva generacion.

---

## T-RF04-01 — Orden directa

**Esperado:** supervisor crea y asigna.

## T-RF04-02 — Mecánico atiende

**Esperado:** registra diagnóstico/actividades/observaciones.

## T-RF04-03 — Transición inválida

**Esperado:** rechazo. No se permite cerrar desde `ASIGNADA` ni `EN_EJECUCION`; `CERRADA` es terminal.

## T-RF04-04 — Cierre incompleto

**Esperado:** rechazo si faltan fechas de ejecucion o actividades realizadas. En orden correctiva, rechazo si falta diagnostico.

## T-RF04-05 — Cierre válido

**Esperado:** supervisor cierra, fecha/responsable registrados, historial disponible.

## T-RF04-06 — Reasignacion auditada

**Esperado:** solo Administrador/Supervisor puede reasignar mecanico y queda registro de responsable/fecha.

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

## T-RF06-01 — Historial supervisor

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

Conductor → reporta → Supervisor → convierte → asigna → Mecánico → ejecuta → Supervisor → cierra → historial → Conductor consulta estado.

## E2E-02 — Preventivo

Supervisor → programa → sistema detecta condicion con umbral 7 dias/500 km → genera orden sin duplicar activas → Mecanico → ejecuta → Supervisor → cierra → actualiza proximo objetivo preventivo → historial.

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
