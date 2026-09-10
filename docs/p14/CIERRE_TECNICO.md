# P14 — Evidencias, aceptación y cierre técnico

**Estado del documento:** cierre técnico final. GATE P14 aprobado; GATE-DOC permanece cerrado.

**Naturaleza del sistema:** prototipo web académico con datos simulados. No representa una integración operacional real con una empresa de transporte.

## A. Resumen ejecutivo

P14 auditó la aplicación desplegada, la trazabilidad RF/RNF, la seguridad por rol, la usabilidad, el desempeño, la mantenibilidad y las alertas. Durante la auditoría se detectaron dos fallos reales de producto: exposición de campos económicos de RF-04 al Mecánico y timeout de la proyección operativa de órdenes para el Despachador. Ambos se corrigieron en backend, frontend y pruebas, se publicaron y se validaron en producción.

El producto cumple RF-01 a RF-06 y RNF-01 a RNF-05. Las credenciales de Vercel, Neon, conexión de base de datos y cuentas demo afectadas por la exposición interna fueron rotadas, revocadas cuando correspondía, almacenadas mediante entrada protegida y verificadas sin registrar valores. La credencial administrativa de Render previamente expuesta fue revocada y retirada de OpenClaw; su reemplazo no se conserva porque la API administrativa de Render no es requisito de runtime ni criterio de P14. El Gate local y el smoke productivo 4/4 quedaron verdes después de la remediación.

## B. Congelación P14-A

| Campo | Estado |
| --- | --- |
| Modelo | `openai/gpt-5.6-sol` |
| Thinking | `high` |
| Rama | `realineacion/trazabilidad-operativa-tecnica` |
| SHA de aplicación auditada | `3a4b0134e8960c499c3d77317ba138acb5ba3137` |
| SHA de cierre P13 original | `9ba39676fddc9bb12af52b10cf7e8ea508647cb9` |
| Diferencia | Corrección de privacidad RF-04, estabilización de prueba de integridad y optimización de proyección para Despachador |
| HEAD local/remoto | Sincronizados; el SHA final se obtiene con `git rev-parse HEAD` |
| Frontend | <https://v0-bus-fleet-management-neon.vercel.app> |
| Backend | <https://sgmv-backend-qvq1.onrender.com> |
| Vercel | READY y desplegado desde el SHA auditado |
| Render | LIVE y desplegado desde el SHA auditado |
| Neon | Proyecto `super-firefly-88354262`, PostgreSQL 17, producción disponible |
| Health | HTTP 200 directo y por `/api/health` |
| Readiness | HTTP 200 directo y por `/api/ready` |
| Migraciones | 23 aplicadas, cero pendientes |
| Datos | Sin seed destructivo, sin recreación y sin migración nueva |
| GATE-DOC | CERRADO, sin modificar documentación académica principal |

El working tree quedó limpio después de publicar los artefactos técnicos P14.

## C. Aceptación formal RF

### RF-01 — Gestión de la flota vehicular

- **Criterios:** datos maestros, jornadas y reasignaciones auditables, exclusión de solapamientos, disponibilidad, kilometraje monotónico y propiedad del Conductor.
- **Implementación:** módulos `fleet` y `journeys`, Prisma y restricciones PostgreSQL.
- **Roles:** Administrador, Despachador y Conductor con proyecciones separadas.
- **Pruebas:** `fleet.test.ts`, `fleet-catalog.test.ts`, `journey.test.ts`, `p12-concurrency.test.ts`, suites frontend y Playwright.
- **Evidencias:** `P14_RF01_ADMIN_FLOTA_1440.png`, `P14_RF01_DESPACHADOR_JORNADAS_1440.png`, `P14_RF01_CONDUCTOR_JORNADA_1024.png`.
- **Resultado:** nueve criterios trazados y aprobados.
- **Riesgo residual:** datos y operación simulados, sin integración externa.

**RF-01: ACEPTADO**

### RF-02 — Control de novedades operativas

- **Criterios:** contexto derivado de sesión, trazabilidad, propiedad, seguridad de uso, alerta/bloqueo, separación Despachador/Administrador y conversión única a orden.
- **Implementación:** módulo `novelties`, disponibilidad y productores de alerta.
- **Roles:** Conductor reporta y consulta lo propio, Despachador gestiona impacto, Administrador revisa y convierte.
- **Pruebas:** `novelty.test.ts`, `alerts.test.ts`, `p12-security.test.ts`, `Novelties.test.tsx`, Playwright P5/P9/P12.
- **Evidencias:** `P14_RF02_CONDUCTOR_NOVEDADES_1440.png`, `P14_RF02_DESPACHADOR_NOVEDADES_1024.png`.
- **Resultado:** siete criterios trazados y aprobados.
- **Riesgo residual:** la advertencia de uso seguro depende también de conducta humana.

**RF-02: ACEPTADO**

### RF-03 — Administración del mantenimiento preventivo

- **Criterios:** plan versionado, umbrales, siguiente ciclo, no duplicación, restricción operativa y privacidad del Despachador.
- **Implementación:** módulos `preventive`, planes por bus/modelo, reconciliación, disponibilidad y alertas.
- **Roles:** Administrador gestiona, sistema evalúa, Despachador recibe proyección operativa mínima.
- **Pruebas:** `preventive*.test.ts`, `p12-concurrency.test.ts`, `PreventiveMaintenance.test.tsx` y Playwright P6.
- **Evidencias:** `P14_RF03_ADMIN_PREVENTIVO_1024.png` y jornada de Despachador.
- **Resultado:** seis criterios trazados y aprobados.
- **Riesgo residual:** en Render Free, la evaluación periódica requiere que la instancia esté activa; las operaciones también reconcilian eventos relevantes.

**RF-03: ACEPTADO**

### RF-04 — Seguimiento de órdenes de trabajo

- **Criterios:** identidad/estado, contexto técnico, propiedad del Mecánico, transiciones administrativas, privacidad del Despachador, cierre trazable y privacidad económica del Mecánico.
- **Implementación:** módulo `work-orders`, DTO por actor y proyección operativa de despacho.
- **Roles:** Administrador conserva economía y cierre, Mecánico recibe solo técnica, Despachador solo estado operativo, Conductor no accede.
- **Pruebas:** `work-order.test.ts`, `p12-security.test.ts`, `WorkOrders.test.tsx`, Playwright P7 y smoke P13/P14.
- **Evidencias:** `P14_RF04_MECANICO_ORDENES_1440.png` sin columna/costo, `P14_RF04_DESPACHADOR_ORDENES_390.png`, pruebas productivas de ausencia de `costoTotal`, `costoUnitario` y `subtotal`.
- **Resultado:** siete criterios trazados y aprobados después de la corrección focalizada.
- **Riesgo residual:** ninguno identificado.

**RF-04: ACEPTADO**

### RF-05 — Central de Repuestos

- **Criterios:** gestión administrativa, consumo autorizado, compatibilidad completa, bloqueo de consumo, excepción auditable y movimiento atómico.
- **Implementación:** módulos `spare-parts` y consumo de RF-04 con snapshot histórico.
- **Roles:** Administrador gestiona y autoriza excepción, Mecánico consume en orden propia, otros roles denegados.
- **Pruebas:** `spare-part.test.ts`, `work-order.test.ts`, `idempotency.test.ts`, `p12-concurrency.test.ts`, frontend y Playwright P8.
- **Evidencias:** `P14_RF05_ADMIN_REPUESTOS_390.png` y trazabilidad de pruebas.
- **Resultado:** seis criterios trazados y aprobados.
- **Riesgo residual:** la calidad de la compatibilidad depende de los datos técnicos simulados configurados.

**RF-05: ACEPTADO**

### RF-06 — Consulta de historial y generación de informes

- **Criterios:** proyección por rol, consultas derivadas sin mutación y reconstrucción de la cadena completa.
- **Implementación:** módulo `reports` sobre entidades RF-01 a RF-05, sin tabla `Informe`.
- **Roles:** Administrador completo/costos, Despachador operativo, Mecánico técnico y Conductor propio.
- **Pruebas:** `report.test.ts`, `p12-security.test.ts`, `History.test.tsx` y Playwright P10/P12.
- **Evidencias:** `P14_RF06_MECANICO_HISTORIAL_1024.png`, `P14_RF06_CONDUCTOR_HISTORIAL_390.png`.
- **Resultado:** seis criterios trazados y aprobados.
- **Riesgo residual:** no incluye exportación ni analítica externa, fuera del alcance aprobado.

**RF-06: ACEPTADO**

## D. Aceptación formal RNF

### RNF-01 — Seguridad de la información

- **Criterios auditados:** autenticación, bcrypt, sesión, cookies HttpOnly/Secure/SameSite=Lax, CSRF, CORS, autorización RBAC/propiedad, 401/403/404, DTO mínimos, validación, auditoría, exposición y secretos.
- **Implementación:** middleware de autenticación/autorización/origen, JWT en cookie, Zod, Prisma/SQL y DTO por rol.
- **Pruebas:** `auth.test.ts`, `p12-security.test.ts`, suites de dominio, Playwright P12 y smoke productivo 4/4.
- **Evidencias:** acceso denegado visual y pruebas productivas de cookies, CSRF, sesión, logout y privacidad económica.
- **Resultado de producto:** aprobado.
- **Remediación operacional:** Vercel, Neon, conexión de base de datos y credencial demo rotadas y verificadas mediante flujos protegidos; la credencial expuesta de Render fue revocada y Borlty ya no conserva acceso administrativo de Render. La API administrativa queda `NOT CONFIGURED / NOT REQUIRED`; el servicio se valida por sus endpoints públicos. Los valores no se imprimieron ni se versionaron.

**RNF-01: ACEPTADO**

### RNF-02 — Usabilidad de la aplicación

- **Criterios:** 390, 1024 y 1440 px, navegación por rol, teclado/foco, estados carga/error/vacío y tareas críticas completables.
- **Pruebas:** 74 pruebas frontend, `p12-accessibility.spec.ts`, `ux-p11.spec.ts` y capturador P14.
- **Evidencias:** 16 PNG actuales con manifest y SHA-256, incluidos los tres viewports mínimos y cuatro roles.
- **Resultado:** aprobado.
- **Riesgo residual:** validación en navegadores modernos, no en navegadores obsoletos.

**RNF-02: ACEPTADO**

### RNF-03 — Desempeño del sistema

- **Medición reproducible local:** 20 muestras, tres consultas derivadas concurrentes por muestra. p50 `16.64 ms`, p95 `40.85 ms`, p99/máximo `166.24 ms`; presupuesto p95 `<= 3000 ms`.
- **Producción:** health/readiness 200. Smoke completo final: 4/4 en `35.6 s`, incluyendo login, navegación, API, cookies, permisos, privacidad económica y logout por los cuatro roles.
- **Hallazgo resuelto:** `/api/ordenes-trabajo/despacho` serializaba cientos de lecturas dentro de una transacción y alcanzaba el timeout de 60 s. Ahora evalúa con el pool y reutiliza disponibilidad por `bus:jornada`.
- **Riesgo residual:** cold start de Render Free puede superar tres segundos tras inactividad; está documentado y no representa el p95 local académico.

**RNF-03: ACEPTADO**

### RNF-04 — Mantenibilidad del software

- **Estructura:** workspaces frontend/backend, módulos por dominio, separación controller/service/repository y Prisma.
- **Gate:** typecheck, lint, formato, builds, presupuesto de bundle, auditoría de dependencias, documentación y configuración reproducible.
- **Resultados:** backend 175/175, frontend 74/74, cero vulnerabilidades npm, auditoría P12 PASS.
- **Riesgo residual:** documentos históricos amplios; este cierre P14 y el inventario son la fuente técnica final.

**RNF-04: ACEPTADO**

### RNF-05 — Alertas internas del sistema

- **Criterios:** origen, destinatario, privacidad, lectura/atención, deduplicación y concurrencia.
- **Implementación:** 15 eventos canónicos, origen tipado, contexto saneado y bandeja individual.
- **Pruebas:** `alerts.test.ts`, integridad, seguridad, concurrencia, frontend y Playwright P9/P12.
- **Evidencias:** `P14_RNF05_MECANICO_ALERTAS_390.png`.
- **Riesgo residual:** evaluador periódico sujeto a actividad de instancia Free; los productores transaccionales siguen operativos.

**RNF-05: ACEPTADO**

## E. Matriz final

`docs/p14/MATRIZ_MAESTRA.csv` contiene una fila por cada criterio RF/RNF, con caso, regla, datos, endpoint, método, rol, pantalla, pruebas, evidencia, comando, resultado, SHA y riesgo residual. Ningún PASS se basa solo en existencia de una tabla, endpoint o pantalla.

## F. Evidencias

- Directorio: `docs/p14/evidencias/`.
- Manifest: `manifest.json` y `manifest.csv`.
- Cantidad: 16 capturas actuales.
- Viewports: 390x844, 1024x768 y 1440x900.
- Roles: Administrador, Despachador, Mecánico y Conductor, más login público.
- Estado auditado: SHA `3a4b0134e8960c499c3d77317ba138acb5ba3137`.
- Integridad: SHA-256 individual en el manifest.
- Evidencia histórica del SHA P13 original: respaldo local fuera del repositorio, no usado para el Gate final.

## G. Demo

El recorrido reproducible y su versión corta están en `docs/p14/DEMO_REPRODUCIBLE.md`. Utiliza exclusivamente cuentas y datos simulados.

## H. Pruebas

| Bloque | Resultado |
| --- | --- |
| Backend | 175/175 PASS |
| Frontend | 74/74 PASS |
| RF-04 backend focalizado | 17/17 PASS |
| RF-04 frontend focalizado | 7/7 PASS |
| Playwright local P7 focalizado | 1/1 PASS |
| Smoke producción | 4/4 PASS |
| Capturador P14 | 1/1 PASS, 16 evidencias |
| Typecheck | PASS |
| Lint | PASS |
| Formato | PASS |
| Builds | PASS |
| `npm audit` | 0 vulnerabilidades |
| Auditoría licencias/secretos | PASS, 0 high/critical, 0 archivos secretos |

Los comandos exactos se encuentran en `docs/p14/INVENTARIO_FINAL.md`.

## I. Seguridad

- Backend aplica rol, propiedad y privacidad de campo.
- Administrador conserva costos autorizados.
- Mecánico, Despachador y Conductor no reciben campos económicos RF-04.
- Neon credential: ROTATED / ACCESS VERIFIED.
- Demo credential: ROTATED / ACCESS VERIFIED.
- Vercel credential: ROTATED / ACCESS VERIFIED.
- Render administrative API: NOT CONFIGURED / NOT REQUIRED; credencial expuesta revocada y retirada de OpenClaw.
- Database runtime credential: ROTATED / ACCESS VERIFIED.
- No se muestran valores, prefijos, sufijos ni fragmentos de secretos.

## J. Producción

- Vercel: <https://v0-bus-fleet-management-neon.vercel.app>.
- Render: <https://sgmv-backend-qvq1.onrender.com>.
- Neon: proyecto de producción `super-firefly-88354262`, 23 migraciones.
- Frontend/backend desplegados desde el mismo SHA de aplicación auditado.
- Smoke productivo 4/4 tras las correcciones y la rotación demo.

## K. Riesgos y pendientes

1. **Riesgo residual aceptable:** cold start de Render Free.
2. **Riesgo residual aceptable:** datos simulados y ausencia de integraciones externas, acorde con el alcance académico.
3. **Pendiente académico externo:** GATE-DOC permanece cerrado. No se modificaron Word, capítulos, conclusiones, metodología, figuras ni diagramas académicos.

## L. Artefactos

Véase `docs/p14/INVENTARIO_FINAL.md`.

## M. Git

La aplicación funcional auditada corresponde a `3a4b0134e8960c499c3d77317ba138acb5ba3137`. Los commits P14 posteriores contienen únicamente capturador, evidencias y documentación técnica y no cambian funcionalidad ni esquema. El Gate confirmó local/remoto limpios y sincronizados después de publicar los artefactos.

## N. Auditoría de modelos

| Bloque | Modelo | Thinking | Motivo | Uso observable | Resultado |
| --- | --- | --- | --- | --- | --- |
| P14-A, interpretación y aceptación | GPT-5.6 Sol | High | Criterios, seguridad y Gate | Checkpoint previo observado: 191k entrada / 25k salida, ventana 5 h 75 %, semanal 21 % | Preflight completado |
| Evidencias, corrección RF-04, desempeño y artefactos | GPT-5.6 Sol | High | Luna no estaba disponible y los hallazgos eran sensibles | Checkpoint tras compactación: 331 entrada / 55 salida visibles, cache 180k, 5 h 69 %, semanal 5 %, una compactación | Trabajo completado hasta bloqueo externo |
| Reanudación y gate local final | GPT-5.6 Terra | High | Cambio impuesto por disponibilidad del runtime; Sol no estaba disponible con el perfil previo | Observable al retomar: 30 días 63 % restante; no hay contador exacto atribuible al bloque | Backend 175/175, frontend 74/74 y verificaciones estáticas verdes |
| Rotaciones, verificación productiva y Gate final | GPT-5.6 Sol | High | Seguridad, proveedores, aceptación RNF-01 y veredicto | Observable al retomar: 127k entrada / 6.4k salida y 27 % mensual restante; no atribuible exclusivamente al bloque | Rotaciones verificadas, smoke 4/4 y Gate P14 aprobado |
| Cierre definitivo y política Render | GPT-5.6 Sol | High | Aplicar `NOT CONFIGURED / NOT REQUIRED`, retirar acceso administrativo y repetir el Gate público | Observable al retomar: 7.2k entrada / 789 salida, 0 % mensual visible; contador reiniciado por compactación y no atribuible solo a este bloque | Render sin credencial conservada, Vercel READY, cinco endpoints 200, smoke 4/4 y Gate aprobado |

No hubo cambio silencioso de modelo ni delegación. Luna no se usó. El consumo exacto por bloque no es observable y no se reconstruye. Las métricas tras compactación no son acumulables con el checkpoint previo.

## O. Veredicto final

**P14 CERRADO — PROYECTO TÉCNICAMENTE ACEPTADO**
