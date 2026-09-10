# Project Status

## P14 en cierre técnico 2026-09-09

P14 auditó el estado desplegado, regeneró 16 evidencias con SHA-256 sobre la aplicación
`3a4b0134e8960c499c3d77317ba138acb5ba3137`, construyó la matriz criterio por criterio
y preparó demo e inventario reproducibles. RF-01 a RF-06 y RNF-02 a RNF-05 quedaron
aceptados. RNF-01 conserva un bloqueo operacional: las API keys de Vercel y Render deben
rotarse manualmente mediante entrada protegida antes del Gate final.

Durante P14 se corrigió la exposición económica de RF-04 al Mecánico en backend y
frontend y se añadieron pruebas de ausencia de campos. También se corrigió el timeout
de la proyección de Despachador eliminando lecturas seriales dentro de una transacción
larga. El smoke productivo posterior aprobó los cuatro roles.

Fuente final: `docs/p14/CIERRE_TECNICO.md`. GATE-DOC permanece cerrado.

**Ultima consolidacion local para Borlty:** 2026-09-09

## P13 cerrado y desplegado 2026-09-09

P13 deja la topologia productiva Browser -> Vercel -> rewrite `/api/*` -> Render ->
Neon en un unico SHA trazable. Vercel usa Vite, `npm run build:vercel`, `dist`, la
rama de realineacion y cero variables de entorno; el proxy serverless obsoleto fue
retirado. Render usa la misma rama, health check `/ready`, una instancia Free y el
build versionado `npm run build:render`. Prisma usa `DIRECT_URL` directa durante el
build y `DATABASE_URL` pooled en runtime; Neon conserva 23 migraciones sin pendientes.

La validacion productiva cubre health/readiness directos y por Vercel, CORS exacto,
CSRF rechazado sin token, cookies HttpOnly/Secure/SameSite=Lax, sesion, logout y RBAC
para Administrador, Despachador, Mecanico y Conductor. El gate final aprobo 175
pruebas backend, 74 frontend, 12 Playwright locales y 4 smoke productivos. Logs
finales de Vercel y Render no mostraron errores, warnings ni indicadores de secretos.
El runbook local documenta observabilidad, limitaciones Free, rollback de frontend y
backend, y roll-forward aditivo de base de datos.

**Siguiente fase autorizable:** P14 — evidencias, aceptacion y cierre final. P14 no fue
iniciada.

## P12 cerrado localmente 2026-09-08

P12 cierra la QA integral y seguridad mediante una matriz RF/RNF verificable, pruebas de RBAC y proyecciones seguras, payloads invalidos, inyeccion, concurrencia de idempotencia, rendimiento local p95, auditoria de dependencias/secretos y verificacion de migraciones desde cero y desde la linea P11. La auditoria Sol HIGH encontro brechas reales en la evidencia de migraciones, axe, payloads, licencias/secretos y privacidad; todas fueron corregidas y revalidadas antes del cierre.

Gate 1 requirio dos ejecuciones fisicas: la primera fallo por un import no usado y una colision de builds; la segunda paso. Gate 2 fue la ejecucion fisica final despues de la auditoria. Resultado final: PostgreSQL activo; Prisma valido y generado; 23 migraciones aplicadas y cero pendientes; fingerprints de esquema y datos coincidentes en base cero/anterior/base; seed idempotente; backend 175/175; frontend 76/76; Playwright 12/12; typecheck, lint, formato, build, bundle y `npm audit` correctos; cero vulnerabilidades altas/criticas y cero archivos de secretos detectados.

**Siguiente fase autorizable:** P13 — despliegue y operacion. P13 no fue iniciada.

## P11 cerrado localmente 2026-09-08

P11 completa la fase de UX, accesibilidad y rendimiento frontend. Las doce paginas funcionales se cargan con `React.lazy` despues de validar su guard de ruta, usan un limite compartido de carga/error recuperable y quedan protegidas por un presupuesto reproducible de bundle. El JavaScript inicial baja de 203,3 KiB gzip a 138,8 KiB gzip; CSS inicial queda en 5,3 KiB gzip y la mayor ruta diferida en 12,3 KiB gzip.

Los dialogos y drawers comparten manejo de foco inicial, trampa de foco, cierre con Escape y restauracion al disparador. Se agregan salto al contenido, titulos por ruta, navegacion semantica, anuncios accesibles de carga/error, soporte de movimiento reducido y guardas de doble envio. La suite monolitica de `App.test.tsx` se reduce a shell/autenticacion y la cobertura se distribuye por modulo.

La verificacion real cubre Chrome y Edge actuales en 390x844, 1024x768 y 1440x900, con teclado, foco, autorizacion por rol, carga diferida y doble envio. Gate final: PostgreSQL disponible; Prisma valido y generado; 23 migraciones aplicadas y cero pendientes; seed idempotente; backend 169/169; frontend 76/76; Playwright 10/10; typecheck, lint, formato, build y presupuesto de bundle correctos; `npm audit` con cero vulnerabilidades. La auditoria Sol HIGH aprobo P11-01 a P11-07.

**Siguiente fase autorizable:** P12 — QA integral y seguridad de cierre. Despues permanecen P13 y P14.

## P10 cerrado localmente 2026-09-08

P10 completa RF-06 mediante consultas derivadas que correlacionan jornada, lecturas, novedad, orden, intervenciones, actividades, consumos, movimientos, compatibilidad, alertas y disponibilidad al cierre. Los filtros se aplican con semantica temporal de la entidad real y conservan alcance de seguridad por rol antes de cargar o proyectar datos.

Administrador recibe cadena completa, costos y tres informes derivados desde snapshots historicos. Despachador recibe contexto operativo sin diagnosticos ni costos; Mecanico solo antecedentes tecnicos de su ambito; Conductor obtiene su jornada, bus, novedades, estados minimos y alertas propias desde la sesion, sin aceptar `busId` ajeno. Las consultas GET no mutan dominio ni crean una tabla `Informe`.

La paginacion y los agregados se ejecutan en base de datos. La ultima orden por bus se resuelve en una consulta agrupada, sin N+1. El seed incorpora una cadena P10 idempotente e inmutable, y el E2E P10 valida los cuatro perfiles y ausencia de efectos laterales.

Gate final: PostgreSQL disponible; Prisma valido y generado; 23 migraciones aplicadas y cero pendientes; seed idempotente; backend 169/169; frontend 72/72; Playwright 6/6; typecheck, lint, formato y build correctos; `npm audit` con cero vulnerabilidades. La auditoria Sol HIGH aprobo P10-01 a P10-08 y las correcciones adversariales de periodo de consumo, filtros de novedad, estado de alerta por destinatario y privacidad del Conductor.

**Siguiente fase autorizable:** P11 — UX, accesibilidad y rendimiento frontend. Despues permanecen P12, P13 y P14.

## P9 cerrado localmente 2026-09-07

P9 completa RNF-05 con un catálogo exhaustivo de quince eventos canónicos y un `AlertService` transaccional. Cada productor deriva destinatarios desde rol, propiedad y contexto persistido; la clave de deduplicación representa una ocurrencia o ciclo y se protege con candado advisory e índices únicos. El contexto se sanea por lista permitida, conserva exactamente un origen normalizado y no persiste credenciales, PII, diagnósticos ni costos.

La API `/alertas` expone únicamente la bandeja del usuario autenticado, con paginación, filtros acumulativos, conteo no leído y transiciones idempotentes `NO_LEIDA -> LEIDA -> ATENDIDA`. La lectura y atención son independientes por destinatario; el cambio posterior de rol no reasigna filas históricas. La UI incorpora campana accesible, contador, filtros por estado/prioridad/tipo/fechas, estados de carga/error/vacío y navegación interna calculada por el rol vigente.

Los productores cubren preventivo próximo/vencido, novedad crítica, bus bloqueado, conflicto de jornada rechazado, kilometrajes inicial/final faltantes, orden pendiente/asignada/completada/devuelta, bajo inventario, consumo incompatible, cambio de jornada y cambio de estado de novedad. El evaluador temporal de jornadas se ejecuta al iniciar y cada quince minutos con deduplicación concurrente.

Gate final: PostgreSQL disponible; Prisma válido y generado; 23 migraciones aplicadas y cero pendientes; seed idempotente; backend 164/164; frontend 71/71; Playwright 5/5; typecheck, lint, formato y build correctos; `npm audit` con cero vulnerabilidades. La auditoría Sol HIGH confirmó cero orígenes inválidos, estados/fechas incoherentes, contextos sensibles o destinatarios duplicados.

**Siguiente fase autorizable:** P10 — Historial e informes. Después permanecen P11, P12, P13 y P14.

## P6 cerrado localmente 2026-09-06

P6-F cerro el ciclo preventivo recurrente de extremo a extremo. La reconciliacion transaccional aplica precedencia `bus > modelo` por `claveTarea` cuando aparece un plan particular, se inactiva una fuente o cambia el modelo del bus. Sin orden activa reemplaza o retira la obligacion inmediatamente; con orden activa conserva la evidencia historica y difiere la nueva fuente hasta el siguiente ciclo. El cambio de modelo considera las claves de los modelos anterior y nuevo, incluidas tareas nuevas o retiradas.

La UI administrativa permite crear, aplicar, versionar, consultar historial e inactivar planes, muestra fuente/version/anticipaciones efectivas de cada obligacion y expone la vista autorizada de restricciones. El seed incorpora un escenario recurrente idempotente. El E2E P6 reproduce creacion/aplicacion, objetivo derivado, vencimiento, restriccion, orden exactamente una vez, retry y proyeccion segura para Despachador.

Gate final: PostgreSQL disponible; Prisma valido y generado; 16 migraciones aplicadas y cero pendientes; backend 143/143; frontend 56/56; Playwright 2/2; typecheck, lint, formato y build correctos; `npm audit` con cero vulnerabilidades. La auditoria Sol HIGH aprobo P6-01 a P6-08 y los escenarios adversariales. No se agrego migracion en P6-F.

## P6-D cerrado localmente 2026-09-06

P6-D extiende la politica de disponibilidad existente sin reemplazar sus causas: usa la clasificacion central del ciclo, por lo que `PROXIMO` no bloquea y `VENCIDO` bloquea unicamente cuando el plan aplicado conserva `bloqueaAlVencer=true`. La causa preventiva se acumula de forma determinista con bus, orden, novedad y jornada; al cerrar/desactivar una obligacion se reevaluan las causas restantes y no se libera un bus que siga restringido.

Se agrego `GET /mantenimiento-preventivo/restricciones`, con RBAC de backend: Administrador recibe la proyeccion permitida del plan y la disponibilidad operacional; Despachador recibe solo bus, estado, objetivos/restantes minimos y restriccion operativa. Mecanico y Conductor reciben `403`; el endpoint no materializa alertas ni expone actividad tecnica, snapshots, diagnosticos, consumos o costos.

El `AlertService` ahora emite `MANTENIMIENTO_PROXIMO` y `MANTENIMIENTO_VENCIDO` desde transacciones de negocio, lecturas de kilometraje, cierre y un evaluador interno periodico. Las alertas se deduplican por ciclo/version/objetivo con candado advisory y clave unica; llegan a Administradores activos y solo llegan a Despachadores cuando un vencimiento bloquea despacho. El contexto contiene solo datos operativos sanitizados. P6-D no implementa la bandeja/acciones de alertas de P9 ni UI de P6-E.

Validacion P6-D: pruebas focalizadas de disponibilidad, causas acumuladas, liberacion, no-bloqueo, destinatarios, privacidad, GET sin efectos y carreras de evaluacion; ademas de P6-C, typecheck, lint y formato. No requiere migracion: reutiliza `AlertaInterna`, `AlertaDestinatario`, restricciones y claves existentes.

## P6-C cerrado 2026-09-05

Se implemento el ciclo preventivo recurrente sobre los planes versionados de P6-B. La aplicacion de un plan materializa una sola `ProgramacionMantenimiento` activa por `bus + claveTarea`, resuelve dentro de la transaccion la precedencia bus sobre modelo y calcula los objetivos iniciales desde la fecha operacional y el kilometraje materializado del bus. La clasificacion admite fecha, kilometraje o ambos, usa anticipaciones particulares y recurre a 7 dias/500 km solo cuando el plan no las configura.

La orden preventiva vuelve a validar elegibilidad bajo candado, deriva prioridad del plan y conserva en `planAplicado` la version, identidad, destino, intervalos, anticipaciones efectivas y objetivos. El cierre administrativo exige un snapshot valido, desactiva la obligacion completada y crea el siguiente objetivo exactamente una vez desde el objetivo anterior; retries y cierres concurrentes no saltan ciclos. Las programaciones independientes se desactivan al cerrar y no generan sucesora.

Validacion P6-C: 31 pruebas focalizadas de preventivo/ordenes y 137/137 en la regresion backend completa, incluidas precedencia integrada, lectura tardia, permisos, materializacion/orden concurrentes, snapshot, retry HTTP y cierre concurrente 50.000 -> 60.000 sin crear 70.000; Prisma, typecheck, lint y formato correctos. No fue necesaria una migracion nueva: se reutilizan el trigger de obligacion y el indice unico parcial de orden activa ya aplicados. Publicado en `287ac7c Implementa ciclo preventivo recurrente idempotente`. P6-D queda limitado a disponibilidad preventiva, proyeccion segura para Despachador y alertas por ciclo.

## P6-B cerrado 2026-09-05

Se implementó el catálogo administrativo de planes preventivos recurrentes, sin materializar todavía obligaciones ni modificar órdenes, disponibilidad, alertas o interfaz. La migración aditiva `20260905200000_p6b_planes_versionado` protege versión histórica y una sola versión activa por destino (`Bus` o `ModeloBus`) y `claveTarea` canónica. Se añadieron endpoints de listado, detalle, primera versión, sucesora e inactivación, todos restringidos al Administrador; el backend valida XOR, forma de intervalos/anticipaciones, destino existente y normaliza `claveTarea`.

La selección interna determinista ya resuelve plan específico de bus sobre plan de modelo únicamente para la misma clave, y permite fallback al modelo si el específico está inactivo. Las pruebas P6-B cubrieron XOR, permisos, duplicado, inmutabilidad/historial, versionado, inactivación, precedencia y carrera de primera versión. P6-C debe materializar y reconciliar `ProgramacionMantenimiento`; no debe reinterpretar ni reemplazar los planes/versiones ya persistidos.

## Diseño P6-A cerrado 2026-09-05

Se analizó el estado real posterior a P5 y se cerró el diseño técnico de preventivo recurrente en `docs/P6A_DISENO_TECNICO_PREVENTIVO_RECURRENTE.md`. No se implementaron cambios funcionales. Quedaron definidos versionado, precedencia bus/modelo, obligación activa, anticipaciones, snapshot, generación idempotente, siguiente objetivo transaccional, disponibilidad, alertas, UI, pruebas y los cortes P6-B a P6-F. El siguiente corte autorizado es P6-B.

## Preflight de linea base 2026-09-04

- PostgreSQL local iniciado correctamente en `localhost:55432`.
- Prisma detecto quince migraciones y confirmo que `sgmv_local` no tiene migraciones pendientes.
- `schema.prisma`, typecheck y lint validados antes de iniciar el primer modulo funcional de realineacion.
- Documentacion local alineada para distinguir estructura persistente ya implementada de servicios/API/UI aun pendientes.
- La linea base publicable quedo protegida en Git en la rama `realineacion/trazabilidad-operativa-tecnica`, commit `667b92b`.

## Estado general

El SGMV mantiene seis RF principales, pero su linea vigente ya no es un registro simple de mantenimiento. La linea academica actualizada exige trazabilidad operativa y tecnica con cuatro roles:

- `ADMINISTRADOR`
- `DESPACHADOR`
- `MECANICO`
- `CONDUCTOR`

El codigo local ya incorporo el primer soporte de `DESPACHADOR`. Desde el corte de base de datos del 2026-09-02, Prisma y PostgreSQL local incluyen la estructura persistente del modelo revisado. P3 completo los catalogos `ModeloBus` y `Ruta`; P4 completo `JornadaOperativa` y kilometraje contextual; P5 completo novedades operativas, disponibilidad y emision de alertas por destinatario; P6 completo el preventivo recurrente. Crear tablas y restricciones no equivale a implementar los flujos futuros.

## Fuente vigente de modelo

Diagramas visuales vigentes del repositorio local:

- `docs/diagrams/SGMV - CASOS DE USO.png`.
- `docs/diagrams/SGMV - Diagrama de Entidad Relacion.png`.
- `docs/diagrams/SGMV - Diagrama de clases unificado.png`.
- `docs/diagrams/SGMV - Modelo Relacional.drawio.png`.

Estos diagramas son insumos estructurales vigentes: el codigo debe conservar su maquina de estados, relaciones, cardinalidades y limites de los seis RF.

Especificacion textual vigente:

`C:\Users\ING-ERIK\Downloads\SGMV_DIAGRAMA_CLASES_ACTUALIZADO.md`

Documentos locales alineados:

- `docs/DATA_MODEL.md`.
- `docs/DATABASE_STRUCTURE.md`.
- `docs/TASKS.md`.
- `docs/PROJECT_STATUS.md`.
- `docs/DECISIONS.md`.

## Avance de implementacion 2026-09-01

Se habilito un flujo de desarrollo con PostgreSQL local para no depender de Neon:

- script `scripts/db-local.ps1`;
- `.env.local` ignorado por Git;
- comandos `db:local:*`, `prisma:*:local`, `test:backend:local` y `dev:backend:local`;
- base local `sgmv_local` en `localhost:55432`.

Tambien se implemento el primer corte del rol `DESPACHADOR`:

- enum Prisma actualizado;
- migraciones nuevas para agregar el valor e insertar el rol;
- seed con usuario `despachador.demo@sgmv.local`;
- clave demo definida localmente como `SEED_USER_PASSWORD` en `.env.local`;
- token de sesion acepta el rol canonico;
- permisos backend iniciales para flota, novedades e historial operativo;
- frontend reconoce el rol, menu, rutas y dashboard operativo;
- historial operativo para Despachador no expone costos ni diagnosticos internos.

Validacion ejecutada en ese corte:

- backend local: 9 archivos, 86 pruebas pasadas;
- frontend: 1 archivo, 46 pruebas pasadas;
- typecheck backend/frontend pasado.

## Corte de persistencia y diagramas 2026-09-02

Se agrego la migracion aditiva `20260902180000_trazabilidad_operativa_tecnica` y se aplico primero a la copia aislada `sgmv_modelo_validacion_20260902`; despues de validar, se aplico a `sgmv_local` en `localhost:55432`. No se utilizo Neon en este corte.

Estado fisico comprobado contra PostgreSQL local y el catalogo que alimenta los diagramas y el diccionario:

- 23 tablas de dominio y 276 columnas.
- 18 tipos enumerados.
- 72 claves foraneas fisicas, incluidas las tres FK compuestas anteriores que refuerzan la coherencia de bus/repuesto.
- 48 restricciones `CHECK` y cuatro restricciones de exclusion de intervalos.
- Quince migraciones aplicadas, sin fallos pendientes.
- 35 filas existentes conservadas en las 16 tablas anteriores, verificadas mediante conteos y huellas de todas sus columnas previas, no solo por numero de filas.

La ampliacion conserva nombres y contratos anteriores. Los campos de contexto agregados a tablas existentes son opcionales durante la transicion: no se inventaron modelos, jornadas, fechas de evento ni evaluaciones de compatibilidad para los registros existentes. Las nuevas tablas tienen sus propias restricciones; donde existe contexto nuevo, se valida su coherencia. No se creo tabla `Informe`.

Validacion posterior a la migracion en la copia aislada:

- 58 pruebas nuevas de integridad: aprobadas.
- Backend: nueve archivos, 86 pruebas aprobadas.
- Frontend: un archivo, 46 pruebas aprobadas.
- Prisma validate/generate/migrate, typecheck, lint, build y formato: aprobados.
- Build frontend con advertencia de tamano del bundle principal, no un error de compilacion.

Estas pruebas verifican los casos ejercitados y la regresion de las funciones existentes; no acreditan por si solas todos los futuros flujos ni una prueba exhaustiva de concurrencia de los nuevos servicios.

Entregables locales de base de datos:

- `C:\Users\ING-ERIK\Downloads\SGMV - Base de datos actualizada\SGMV - Diagrama Entidad Relacion.png`.
- `C:\Users\ING-ERIK\Downloads\SGMV - Base de datos actualizada\SGMV - Modelo Relacional.png`.
- `C:\Users\ING-ERIK\Downloads\SGMV - Base de datos actualizada\SGMV - Diccionario de datos.docx`.

Las evidencias de validacion y conservacion estan en `C:\Users\ING-ERIK\Downloads\SGMV - Base de datos actualizada\verificacion`. El entidad-relacion sigue la notacion del PDF academico indicado por Jefe. Los documentos anteriores se conservan como antecedentes; para la estructura fisica de este corte deben consultarse estos entregables y la migracion aplicada.

## Codigo implementado antes de la realineacion completa

Implementado:

- monorepo `src/frontend` y `src/backend`;
- React, Vite, Tailwind CSS;
- Node.js, Express, API REST;
- Prisma, Zod y PostgreSQL/Neon;
- autenticacion con bcrypt y JWT en cookie HttpOnly;
- autorizacion por roles;
- RF-01 flota;
- RF-02 novedades;
- RF-03 mantenimiento preventivo;
- RF-04 ordenes de trabajo;
- RF-05 central de repuestos;
- RF-06 historial e informes;
- pruebas backend/frontend por RF;
- evidencias visuales;
- rol `DESPACHADOR` con acceso operativo inicial limitado.

## Modelo objetivo revisado

La trazabilidad objetivo es:

```text
bus + conductor + despachador + jornada + kilometraje
  -> novedad
  -> orden
  -> intervencion
  -> consumo de repuesto compatible
  -> movimiento de inventario
  -> alerta interna por destinatario
  -> historial/informe
```

El diagrama revisado organiza el modelo en nueve vistas:

1. Identidad y flota.
2. Jornadas y novedades.
3. Kilometraje contextual.
4. Planificacion preventiva.
5. Ordenes y ejecucion tecnica.
6. Repuestos e inventario.
7. Trazabilidad del consumo.
8. Alertas internas por destinatario.
9. Auditoria e historial/informes.

## Estructura persistente incorporada

- Nuevas tablas/modelos: `ModeloBus`, `Ruta`, `JornadaOperativa`, `PlanMantenimientoPreventivo`, `CompatibilidadRepuesto`, `AlertaInterna` y `AlertaDestinatario`.
- Relaciones de bus/modelo y de jornada con responsables, segmento anterior, ruta y lecturas.
- Campos de tipo y fecha de evento en `LecturaKilometraje`, y vinculos con novedad, orden e intervencion.
- Contexto operacional, criticidad y banderas en `Novedad`.
- Plan opcional y prioridad en `ProgramacionMantenimiento`.
- Jornada y campos para snapshots de plan/disponibilidad en `OrdenTrabajo`.
- Fabricante, numero de parte y especificaciones/dimensiones en `Repuesto`.
- Intervencion, regla/version, resultado/evidencia y autorizacion excepcional en `ConsumoRepuesto`.
- Origen tipado, deduplicacion, destinatarios y estados individuales de alerta.

## Flujos funcionales que aun faltan

- Registro tecnico que exija contexto completo en los nuevos endpoints, sin depender del contrato transitorio anterior.
- Ampliacion de la politica de disponibilidad con preventivo y cierres tecnicos que se implementan en P6-P9.
- Integracion de preventivo vencido con disponibilidad, restricciones seguras del Despachador y alertas preventivas por ciclo (P6-D).
- Gestion de compatibilidad en interfaz y servicios, seleccion de regla aplicable, bloqueo de consumo incompatible y excepciones autorizadas desde una sesion real.
- Completar en P9 la bandeja y las acciones de lectura/atencion; P5 ya genera alertas de novedad critica y bus bloqueado con destinatarios por rol.
- Ampliacion de `ServicioHistorialInformes` para reconstruir y filtrar toda la trazabilidad nueva sin exponer datos fuera del alcance de cada rol.
- Pruebas integradas de los nuevos endpoints y pantallas, incluyendo permisos y concurrencia al implementar cada flujo.

## RF vigentes

Se conservan los nombres:

1. RF-01 - Gestion de la flota vehicular.
2. RF-02 - Control de novedades operativas.
3. RF-03 - Administracion del mantenimiento preventivo.
4. RF-04 - Seguimiento de ordenes de trabajo.
5. RF-05 - Central de Repuestos.
6. RF-06 - Consulta de historial y generacion de informes.

## RNF vigentes

1. Seguridad de la informacion.
2. Usabilidad de la aplicacion.
3. Desempeno del sistema.
4. Mantenibilidad del software.
5. Alertas internas del sistema.

RNF-05 es interno. No implica SMS, WhatsApp, correo automatico, push externo ni integraciones.

## Cierre funcional P4 2026-09-05

- `JornadaOperativa` es la agenda operativa vigente; `AsignacionConductor` conserva consulta historica y ya no expone escritura HTTP.
- Administrador y Despachador programan, inician, finalizan, cancelan y reasignan; el Conductor consulta y opera solo su jornada.
- Inicio/fin y lectura contextual se confirman atomicamente, con actores derivados de sesion.
- El odometro valida vecinas por fecha real del evento y `Bus.kilometrajeActual` conserva el maximo sin retroceder ante capturas tardias.
- La reasignacion termina el tramo anterior y crea una jornada sucesora; no reescribe el historial.
- Las exclusiones SQL y los bloqueos de servicio cubren concurrencia por bus y conductor.

Validacion P4: 125 pruebas backend, 54 frontend, seed doble idempotente, Prisma sin migraciones pendientes, typecheck, lint, formato, build y auditoria con cero vulnerabilidades. El bundle frontend conserva una advertencia no bloqueante de 783,72 kB.

## Cierre funcional P5 2026-09-05

- El Conductor reporta una novedad propia por fecha de ocurrencia; jornada, bus y conductor se derivan de sesion y contexto temporal.
- La lectura de kilometraje queda enlazada a jornada y novedad, valida sus vecinas cronologicas y no reduce el odometro actual ante reportes tardios.
- Administracion clasifica criticidad, impacto y bloqueo; la disponibilidad centralizada refleja inmediatamente una novedad bloqueante.
- Las alertas de novedad critica y bus bloqueado se crean dentro de la misma transaccion y solo para destinatarios activos autorizados.
- El Despachador recibe datos operativos minimos y puede coordinar la jornada sin acceder al diagnostico ni ejecutar cierre tecnico.
- La conversion correctiva conserva la relacion jornada-novedad-orden y cierra la brecha de disponibilidad durante la conversion.

Validacion P5: 128 pruebas backend, 54 frontend y un escenario E2E Playwright Conductor → Administrador → Despachador. Tambien pasaron Prisma, typecheck, lint, formato, build, IDOR, reporte tardio, idempotencia y concurrencia de conversion.

## Cierre funcional P7 2026-09-07

- Las ordenes exigen origen coherente y conservan jornada cuando nacen de una novedad operacional.
- Las lecturas tecnicas de ingreso, revision y cierre comparten la politica cronologica y el candado del odometro operativo.
- Diagnostico, actividades y consumos nuevos exigen una intervencion activa de la orden y del mecanico vigente.
- El cierre administrativo conserva snapshots de plan y disponibilidad, recalcula las restricciones restantes y mantiene `CERRADA` como estado terminal.
- La proyeccion del Despachador limita el contrato a estado, bus, disponibilidad y causas operativas; no expone diagnosticos, actividades, consumos ni costos.
- Reasignacion y devolucion conservan responsables, intervenciones y actividades previas.

Validacion P7: 149 pruebas backend, 57 frontend y tres escenarios E2E Playwright acumulados, incluido Administrador → Mecanico → Administrador → Despachador para P7. Tambien pasaron seed idempotente, 18 migraciones sin pendientes, typecheck, lint, formato, build y auditoria con cero vulnerabilidades.

## Cierre funcional P8 2026-09-07

- Los repuestos exponen fabricante, numero de parte, especificaciones y dimensiones, y el Administrador gestiona reglas versionadas por bus o modelo.
- La resolucion efectiva aplica precedencia `bus > modelo`; una regla negativa especifica no cae a una positiva general y la ausencia de evidencia positiva rechaza el consumo.
- Todo consumo nuevo exige una intervencion activa de la misma orden, conserva snapshot de regla/version/evidencia y confirma stock, consumo, movimiento y costo historico atomicamente.
- El rechazo incompatible conserva stock y no crea consumo ni movimiento, pero materializa una alerta interna deduplicada con contexto saneado.
- La excepcion es puntual, previa, revocable, de un solo uso y separa al Administrador autorizador del Mecanico consumidor; PostgreSQL protege tambien escrituras directas.
- La UI cubre datos tecnicos, reglas, historial/versionado, inactivacion y autorizaciones excepcionales, sin ampliar permisos del Despachador.

Validacion P8: 158 pruebas backend, 59 frontend y cuatro escenarios E2E Playwright acumulados, incluido Administrador → Mecanico para rechazo incompatible, regla versionada y consumo autorizado. Tambien pasaron seed idempotente, 22 migraciones sin pendientes, typecheck, lint, formato, build y auditoria con cero vulnerabilidades.

## Advertencia para proximas tareas

No afirmar cumplimiento total de la nueva linea. P3-P8 estan completos localmente; P9-P13 siguen pendientes. Las restricciones SQL no sustituyen autorizacion de sesion, reglas de servicio ni pantallas.

La siguiente implementacion, solo con orden de Jefe, debe ser P9. No iniciarla ni recrear tablas ya migradas sin una orden nueva.

## Git

Jefe pidio que la documentacion Markdown para Borlty quede local y no se suba al repo. No hacer commit/push de estos `.md` sin autorizacion explicita.
