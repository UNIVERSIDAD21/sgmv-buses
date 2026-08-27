# Tasks — Fase 3

## Estado

Este archivo es el tablero operativo del agente.

**No marcar el inicio de implementación hasta recibir la orden explícita `INICIAR FASE 3`.**

**Estado actual:** interfaz oficial y autenticación transversal implementadas sobre la Persistencia cerrada. Todavía no implementar RF-01 a RF-06 completos sin nueva autorización del propietario.

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
- [x] Validación de `Origin` como protección equivalente para escrituras de autenticación.
- [x] Límite de intentos de inicio de sesión.
- [x] Expiración definida del JWT.
- [x] Verificar que respuestas y pruebas no incluyan contraseñas, hashes ni tokens.
- [x] Cuenta activa/inactiva.
- [x] Autorización por rol en backend.
- [x] Protección de rutas frontend.
- [ ] Gestión mínima de cuentas para Administrador/Supervisor.
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
- [x] Crear panel diferenciado para Administrador/Supervisor.
- [x] Crear panel diferenciado para Mecánico.
- [x] Crear panel diferenciado para Conductor/Operador.
- [x] Crear vista base de flota sin RF-01 completo.
- [x] Crear formulario visual de buses sin persistencia RF-01.
- [x] Crear estados de carga, error, vacío y éxito.
- [x] Mantener la indicación "Prototipo académico — Datos simulados".
- [x] Rechazar configuración, mock data, tipos y dependencias vulnerables del ZIP.
- [x] Documentar diseño visual seleccionado.

---

# 4. RF-01 — Gestión de la flota vehicular

- [ ] CRUD no destructivo de buses.
- [ ] Identificación única.
- [ ] Estado operativo.
- [ ] Kilometraje.
- [ ] Asignación conductor-bus.
- [ ] Historial de asignaciones.
- [ ] Garantizar maximo un bus activo por conductor.
- [ ] Garantizar maximo un conductor activo por bus.
- [ ] Vista limitada del conductor.
- [ ] Pruebas de aislamiento entre conductores.

---

# 5. RF-02 — Control de novedades operativas

- [ ] Formulario de novedad para conductor.
- [ ] Asociación automática autor/bus/fecha.
- [ ] Listado de novedades propias del conductor.
- [ ] Bandeja de gestión para supervisor.
- [ ] Clasificación.
- [ ] Resolución/descartar según flujo.
- [ ] Conversión a orden.
- [ ] Prevención de orden duplicada.
- [ ] Seguimiento visible para el autor.

---

# 6. RF-03 — Administración del mantenimiento preventivo

- [ ] Crear programación.
- [ ] Criterio por fecha.
- [ ] Criterio por kilometraje.
- [ ] Criterio combinado.
- [ ] Implementar umbral aprobado de "proximo": 7 dias y 500 km.
- [ ] Estados de seguimiento.
- [ ] Vista de próximos/vencidos.
- [ ] Generar orden preventiva.
- [ ] Mantener relación programación-orden.
- [ ] Evitar mas de una orden activa por programacion.
- [ ] Actualizar proxima fecha o proximo kilometraje al cerrar orden preventiva.

---

# 7. RF-04 — Seguimiento de órdenes de trabajo

- [ ] Implementar maquina de estados aprobada.
- [ ] Crear orden correctiva directa.
- [ ] Recibir orden desde novedad.
- [ ] Recibir orden desde preventivo.
- [ ] Asignar mecánico.
- [ ] Bandeja de órdenes del mecánico.
- [ ] Consulta de antecedentes.
- [ ] Inicio de trabajo.
- [ ] Reasignacion de mecanico solo por Administrador/Supervisor con auditoria.
- [ ] Registro de diagnóstico.
- [ ] Registro de actividades.
- [ ] Registro de observaciones.
- [ ] Integración con consumo de repuestos.
- [ ] Marcar completado por técnico.
- [ ] Exigir fechas de ejecucion y actividades para completar por tecnico.
- [ ] Exigir diagnostico en ordenes correctivas.
- [ ] Mantener consumo de repuestos como opcional.
- [ ] Validar/cerrar por supervisor.
- [ ] Garantizar `CERRADA` como estado terminal.
- [ ] Impedir cierre desde `ASIGNADA` o `EN_EJECUCION`.
- [ ] Registrar responsable/fechas.
- [ ] Actualizar disponibilidad en historial.

---

# 8. RF-05 — Central de Repuestos

- [ ] Catálogo.
- [ ] Existencias.
- [ ] Entradas.
- [ ] Ajustes administrativos.
- [ ] Consulta de stock por mecánico.
- [ ] Consumo asociado a orden.
- [ ] Transacción atómica consumo + movimiento + stock.
- [ ] Historial de movimientos.
- [ ] Validación de cantidades.
- [ ] Prueba de stock insuficiente.
- [ ] Cálculo de subtotal.

---

# 9. RF-06 — Consulta de historial y generación de informes

- [ ] Consulta de historial por bus.
- [ ] Historial derivado de datos validados.
- [ ] Vista técnica para mecánico.
- [ ] Vista limitada para conductor.
- [ ] Informes para supervisor.
- [ ] Filtro por bus.
- [ ] Filtro por período.
- [ ] Filtro por tipo de intervención.
- [ ] Costos básicos.
- [ ] Verificar coherencia contra BD.
- [ ] No introducir analítica predictiva.

---

# 10. Integración

- [ ] Probar flujo conductor → novedad → orden → mecánico → cierre → historial.
- [ ] Probar flujo preventivo → orden → mecánico → cierre → historial.
- [ ] Probar flujo orden → consumo → inventario.
- [ ] Probar permisos por API.
- [ ] Probar manejo de errores.
- [ ] Revisar responsive.

---

# 11. Pruebas finales

- [ ] Ejecutar casos RF.
- [ ] Ejecutar casos RNF.
- [ ] Validar Chrome.
- [ ] Validar Edge.
- [ ] Medir operaciones habituales para RNF-03.
- [ ] Confirmar cero errores bloqueantes en flujos principales.
- [ ] Registrar fallos/correcciones.

---

# 12. Despliegue y cierre

- [ ] Configurar frontend en Vercel.
- [ ] Configurar API en Render.
- [ ] Configurar PostgreSQL en Neon.
- [ ] HTTPS.
- [ ] Variables de entorno.
- [ ] Configurar CORS/cookies/CSRF segun dominios Vercel/Render.
- [ ] Migraciones en entorno destino.
- [ ] Seed/demo seguro si se requiere.
- [ ] Smoke test.
- [ ] Actualizar `README.md`/`SETUP.md`.
- [ ] Revisar diff final.
- [ ] Commit y push.
- [ ] Entregar resumen de módulos implementados, pruebas y pendientes.
