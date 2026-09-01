# Tasks — Fase 3

## Estado

Este archivo es el tablero operativo del agente.

**No marcar el inicio de implementación hasta recibir la orden explícita `INICIAR FASE 3`.**

**Estado actual:** interfaz oficial, autenticación transversal, normalización de roles canónicos y RF-01 a RF-06 implementados sobre la Persistencia cerrada. RF-06 fue autorizado el 2026-08-31 y se implementó sin migración ni tabla `Informe`.

---

# Gate 0 — Autorización

- [x] Recibir autorización explícita del propietario para iniciar Fase 3.
- [x] Leer `AGENTS.md` y toda la documentación obligatoria.
- [x] Guardar resumen estable del proyecto en memoria.
- [x] Reportar contradicciones o dudas bloqueantes antes de escribir código.
- [x] Registrar decisiones tecnicas aprobadas con ajustes finales.

---

# 1. Bootstrap del repositorio

- [x] Definir estructura final `src/frontend` y `src/backend`.
- [x] Inicializar frontend React + Vite.
- [x] Configurar Tailwind CSS.
- [x] Inicializar backend Node.js + Express.
- [x] Definir estrategia de dependencias/workspaces.
- [x] Configurar Prisma ORM.
- [x] Configurar Zod.
- [x] Configurar lint/format con ESLint y Prettier.
- [x] Crear scripts de desarrollo, test y build.
- [x] Documentar decisiones técnicas.

### Done cuando

- frontend levanta;
- backend levanta;
- build funciona;
- no hay secretos en Git.

---

# 2. Persistencia

- [x] Guardar diagramas oficiales de Fase 2 en `docs/diagrams/` sin alterar contenido.
- [x] Analizar diagrama de casos de uso general y diagrama de clases del sistema.
- [x] Registrar interpretación oficial de los diagramas en `docs/DECISIONS.md`.
- [x] Actualizar `docs/DATA_MODEL.md` con relaciones oficiales.
- [x] Corregir `docs/PERSISTENCE_MODEL_PROPOSAL.md` sin tocar `schema.prisma`.
- [x] Crear trazabilidad actor/RF/clases/tablas técnicas.
- [x] Verificar nombres oficiales de los seis RF en la documentación actualizada.
- [x] Recibir aprobación explícita del propietario para implementar Persistencia.
- [x] Configurar conexión PostgreSQL/Neon.
- [x] Implementar Prisma ORM como estrategia SQL/ORM aprobada.
- [x] Crear migraciones.
- [x] Implementar tablas/relaciones del modelo vigente.
- [x] Aplicar PK/FK/UNIQUE/CHECK.
- [x] Crear seed de desarrollo.
- [x] Crear migracion correctiva/aditiva sin modificar retroactivamente la migracion inicial.
- [x] Validar coherencia bus-orden para novedades y programaciones preventivas.
- [x] Validar coherencia consumo-movimiento-repuesto.
- [x] Exigir un movimiento de inventario tipo `CONSUMO` por cada consumo de repuesto.
- [x] Calcular `subtotal` y `costoTotal` sin depender de valores enviados por cliente.
- [x] Validar fechas cronologicas de ordenes y `CERRADA` terminal.
- [x] Exigir motivo para entradas y ajustes de inventario.
- [x] Normalizar emails, placas y codigos contra duplicados por mayusculas/minusculas.
- [x] Fijar `search_path` en funciones PL/pgSQL de triggers para validacion multi-schema en Neon.
- [x] Exigir `SEED_USER_PASSWORD` y eliminar contrasena demo predeterminada del codigo.
- [x] Crear `docs/DATABASE_STRUCTURE.md`.
- [x] Crear `docs/DATA_DICTIONARY.md`.
- [x] Crear diagrama relacional fisico editable `.drawio` y PNG.
- [x] Ampliar pruebas negativas de integridad.
- [x] Probar integridad y relaciones críticas de persistencia.

---

# 3. Acceso y seguridad transversal

- [x] Modelo de Rol.
- [x] Modelo de Usuario.
- [x] Login.
- [x] Contraseñas con hash seguro.
- [x] JWT en cookie `HttpOnly`.
- [x] `Secure=true` en producción y `SameSite` según entorno.
- [x] Interpretar correctamente `COOKIE_SECURE=false` para sesiones locales HTTP.
- [x] Validación de `Origin` como protección equivalente para escrituras de autenticación.
- [x] Límite de intentos de inicio de sesión.
- [x] Expiración definida del JWT.
- [x] Verificar que respuestas y pruebas no incluyan contraseñas, hashes ni tokens.
- [x] Cuenta activa/inactiva.
- [x] Autorización por rol en backend.
- [x] Protección de rutas frontend.
- [ ] Gestión mínima de cuentas para Administrador.
- [x] Manejo controlado de errores.
- [x] Validación de entradas.

**Nota:** esto no crea un RF adicional. Las escrituras futuras de RF deben reutilizar autorización backend y CSRF o validación equivalente antes de exponerse.

---

# 3.1 Interfaz visual oficial

- [x] Auditar ZIP de Figma Make sin alterar el original.
- [x] Integrar identidad visual minimalista modular.
- [x] Implementar menú lateral colapsable con tooltips accesibles.
- [x] Mostrar nombres oficiales exactos de RF-01 a RF-06.
- [x] Crear encabezado contextual con fecha dinámica `es-CO`.
- [x] Crear panel diferenciado para Administrador.
- [x] Crear panel diferenciado para Mecánico.
- [x] Crear panel diferenciado para Conductor.
- [x] Crear vista base de flota sin RF-01 completo.
- [x] Crear formulario visual de buses sin persistencia RF-01.
- [x] Crear estados de carga, error, vacío y éxito.
- [x] Mantener la indicación "Prototipo académico — Datos simulados".
- [x] Rechazar configuración, mock data, tipos y dependencias vulnerables del ZIP.
- [x] Documentar diseño visual seleccionado.
- [x] Ejecutar auditoria final de interfaz oficial y autenticacion sin iniciar RF-01.
- [x] Corregir defectos puntuales de accesibilidad, estado pendiente, pruebas y captura movil.

---

# 3.2 Normalizacion transversal de roles canonicos

- [x] Auditar valores persistidos, enums, autorizacion, frontend, documentacion, diagramas, seeds y pruebas.
- [x] Establecer catalogo unico de roles `ADMINISTRADOR`, `CONDUCTOR` y `MECANICO`.
- [x] Normalizar etiquetas visibles a Administrador, Conductor y Mecánico.
- [x] Crear migracion correctiva sin editar migraciones aplicadas.
- [x] Rechazar alias de sesion como `SUPERVISOR`, `OPERADOR`, `OPERARIO`, `TECNICO`, `ADMIN_SUPERVISOR` y `CONDUCTOR_OPERADOR`.
- [x] Verificar que RF-01 y RF-02 conservan permisos y comportamiento.
- [x] Registrar decision formal en `docs/DECISIONS.md`.

---

# 4. RF-01 — Gestión de la flota vehicular

- [x] CRUD no destructivo de buses.
- [x] Identificación única.
- [x] Estado operativo.
- [x] Kilometraje.
- [x] Asignación conductor-bus.
- [x] Historial de asignaciones.
- [x] Garantizar maximo un bus activo por conductor.
- [x] Garantizar maximo un conductor activo por bus.
- [x] Vista limitada del conductor.
- [x] Pruebas de aislamiento entre conductores.

---

# 5. RF-02 — Control de novedades operativas

- [x] Formulario de novedad para conductor.
- [x] Asociación automática autor/bus/fecha.
- [x] Listado de novedades propias del conductor.
- [x] Bandeja de gestión para administrador.
- [x] Clasificación.
- [x] Resolución/descartar según flujo.
- [x] Conversión a orden.
- [x] Prevención de orden duplicada.
- [x] Seguimiento visible para el autor.

---

# 6. RF-03 — Administración del mantenimiento preventivo

- [x] Crear programación.
- [x] Criterio por fecha.
- [x] Criterio por kilometraje.
- [x] Criterio combinado.
- [x] Implementar umbral aprobado de "proximo": 7 dias y 500 km.
- [x] Estados de seguimiento.
- [x] Vista de próximos/vencidos.
- [x] Generar orden preventiva.
- [x] Mantener relación programación-orden.
- [x] Evitar mas de una orden activa por programacion.
- [x] Evaluar actualizacion de proxima fecha o proximo kilometraje al cerrar orden preventiva. RF-04 conserva objetivos copiados y no recalcula porque no existen campos fisicos de intervalo preventivo aprobados.

---

# 7. RF-04 — Seguimiento de órdenes de trabajo

- [x] Implementar maquina de estados aprobada.
- [x] Crear orden correctiva directa.
- [x] Recibir orden desde novedad.
- [x] Recibir orden desde preventivo.
- [x] Asignar mecanico.
- [x] Bandeja de ordenes del mecanico.
- [x] Consulta de antecedentes.
- [x] Inicio de trabajo.
- [x] Reasignacion de mecanico solo por Administrador con auditoria.
- [x] Registro de diagnostico.
- [x] Registro de actividades.
- [x] Registro de observaciones.
- [x] Integracion con consumo de repuestos.
- [x] Marcar completado por tecnico.
- [x] Exigir fechas de ejecucion y actividades para completar por tecnico.
- [x] Exigir diagnostico en ordenes correctivas.
- [x] Mantener consumo de repuestos como opcional.
- [x] Validar/cerrar por administrador.
- [x] Garantizar `CERRADA` como estado terminal.
- [x] Impedir cierre desde `ASIGNADA` o `EN_EJECUCION`.
- [x] Registrar responsable/fechas.
- [x] Mantener historial tecnico disponible mediante orden, intervenciones, actividades, consumos y movimientos.
- [x] Proteger doble envio de consumo con `clave_idempotencia`.
- [x] Documentar los limites de RF-04 frente a RF-05 y RF-06.

---

# 8. RF-05 — Central de Repuestos

Nota: RF-05 implementa la central administrativa de repuestos para Administrador. El Mecánico no administra inventario; conserva únicamente la consulta minima y consumo de repuestos dentro de una orden RF-04 asignada y en ejecución.

- [x] Catálogo paginado, buscable, filtrable y ordenado desde backend.
- [x] Existencias actuales sin edición directa por `PATCH`.
- [x] Alta con stock cero.
- [x] Alta con stock inicial trazable por movimiento.
- [x] Disponibilidad centralizada: `DISPONIBLE`, `BAJO`, `AGOTADO`, `INACTIVO`.
- [x] Entradas administrativas con transacción, responsable, motivo e idempotencia.
- [x] Ajustes administrativos positivos y negativos con motivo obligatorio.
- [x] Consulta minima de stock por Mecánico conservada en RF-04, sin acceso a central administrativa.
- [x] Consumo asociado a orden desde RF-04.
- [x] Transacción atómica consumo + movimiento + stock.
- [x] Historial de movimientos general y por repuesto.
- [x] Relación visible con orden y consumo cuando el movimiento proviene de RF-04.
- [x] Validación de cantidades, costos y campos sensibles con Zod.
- [x] Prueba de stock insuficiente.
- [x] Cálculo de subtotal y costo histórico fotografiado en consumo.
- [x] Valor básico actual de inventario sin valoración contable avanzada.
- [x] Pruebas de concurrencia, rollback e idempotencia.
- [x] Evidencias visuales RF-05 en `docs/screenshots/`.

---

# 9. RF-06 — Consulta de historial y generación de informes

- [x] Consulta de historial por bus.
- [x] Historial derivado de datos validados.
- [x] Vista técnica para mecánico.
- [x] Vista limitada para conductor.
- [x] Informes para administrador.
- [x] Filtro por bus.
- [x] Filtro por período.
- [x] Filtro por tipo de intervención.
- [x] Costos básicos.
- [x] Verificar coherencia contra BD.
- [x] No introducir analítica predictiva.

---

# 10. Integración

- [x] Probar flujo conductor → novedad → orden → mecánico → cierre como regresión RF-02/RF-04.
- [x] Probar flujo preventivo → orden → mecánico → cierre como regresión RF-03/RF-04.
- [x] Probar flujo orden → consumo → inventario.
- [x] Probar permisos por API.
- [x] Probar manejo de errores.
- [x] Revisar responsive en `1440x900`, `1024x768` y `390x844`.

---

# 11. Pruebas finales

- [x] Ejecutar casos RF-01 a RF-06 automatizados.
- [x] Ejecutar casos RNF cubiertos por auth, permisos, validación, build, lint, typecheck y pruebas visuales.
- [x] Validar Chromium/Chrome mediante Playwright.
- [ ] Validar Edge.
- [ ] Medir operaciones habituales para RNF-03.
- [x] Confirmar cero errores bloqueantes en flujos principales RF-01 a RF-06.
- [x] Registrar fallos/correcciones.

---

# 12. Despliegue y cierre

- [ ] Configurar frontend en Vercel.
- [ ] Configurar API en Render.
- [ ] Configurar PostgreSQL en Neon.
- [ ] HTTPS.
- [ ] Variables de entorno.
- [ ] Configurar CORS/cookies/CSRF segun dominios Vercel/Render.
- [ ] Migraciones en entorno destino.
- [x] Seed/demo seguro e idempotente para RF-05 en entorno de validacion.
- [ ] Smoke test.
- [x] Actualizar `README.md` y documentación técnica afectada.
- [ ] Revisar diff final.
- [ ] Commit y push.
- [ ] Entregar resumen de módulos implementados, pruebas y pendientes.
