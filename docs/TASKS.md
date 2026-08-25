# Tasks — Fase 3

## Estado

Este archivo es el tablero operativo del agente.

**No marcar el inicio de implementación hasta recibir la orden explícita `INICIAR FASE 3`.**

---

# Gate 0 — Autorización

- [ ] Recibir autorización explícita del propietario para iniciar Fase 3.
- [x] Leer `AGENTS.md` y toda la documentación obligatoria.
- [x] Guardar resumen estable del proyecto en memoria.
- [x] Reportar contradicciones o dudas bloqueantes antes de escribir código.
- [x] Registrar decisiones tecnicas aprobadas con ajustes finales.

---

# 1. Bootstrap del repositorio

- [ ] Definir estructura final `src/frontend` y `src/backend`.
- [ ] Inicializar frontend React + Vite.
- [ ] Configurar Tailwind CSS.
- [ ] Inicializar backend Node.js + Express.
- [ ] Definir estrategia de dependencias/workspaces.
- [ ] Configurar Prisma ORM.
- [ ] Configurar Zod.
- [ ] Configurar lint/format con ESLint y Prettier.
- [ ] Crear scripts de desarrollo, test y build.
- [ ] Documentar decisiones técnicas.

### Done cuando

- frontend levanta;
- backend levanta;
- build funciona;
- no hay secretos en Git.

---

# 2. Persistencia

- [ ] Configurar conexión PostgreSQL/Neon.
- [ ] Implementar Prisma ORM como estrategia SQL/ORM aprobada.
- [ ] Crear migraciones.
- [ ] Implementar tablas/relaciones del modelo vigente.
- [ ] Aplicar PK/FK/UNIQUE/CHECK.
- [ ] Crear seed de desarrollo.
- [ ] Probar transacciones críticas.

---

# 3. Acceso y seguridad transversal

- [ ] Modelo de Rol.
- [ ] Modelo de Usuario.
- [ ] Login.
- [ ] Contraseñas con hash seguro.
- [ ] JWT en cookie `HttpOnly`.
- [ ] `Secure=true` en produccion y `SameSite` segun entorno.
- [ ] Proteccion CSRF o validacion equivalente para escrituras.
- [ ] Limite de intentos de inicio de sesion.
- [ ] Expiracion definida del JWT.
- [ ] Verificar que logs no incluyan contrasenas, hashes ni tokens.
- [ ] Cuenta activa/inactiva.
- [ ] Autorización por rol en backend.
- [ ] Protección de rutas frontend.
- [ ] Gestión mínima de cuentas para Administrador/Supervisor.
- [ ] Manejo controlado de errores.
- [ ] Validación de entradas.

**Nota:** esto no crea un RF adicional.

---

# 4. RF-01 — Flota

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

# 5. RF-02 — Novedades

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

# 6. RF-03 — Mantenimiento preventivo

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

# 7. RF-04 — Órdenes de trabajo

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

# 8. RF-05 — Repuestos

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

# 9. RF-06 — Historial e informes

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
