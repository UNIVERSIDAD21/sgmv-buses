# Decisiones tecnicas aprobadas

**Estado:** APROBADO POR EL PROPIETARIO
**Fecha:** 2026-08-25
**Aplica a:** Fase 3 - Desarrollo, integracion y validacion del prototipo

Este documento registra decisiones tecnicas aprobadas para iniciar Fase 3 sin redefinir requerimientos, roles, casos de uso, reglas de negocio ni alcance aprobado.

La autenticacion, gestion minima de cuentas, roles y permisos se tratan como funcionalidad transversal. No crean un RF-07 ni convierten "Gestion de usuarios" o "Iniciar sesion" en RF principal.

---

## 1. Estados exactos de las novedades

### Opcion recomendada

Decision aprobada: usar un enum tecnico `estado_novedad` con estos valores:

- `PENDIENTE_REVISION`
- `RESUELTA_SIN_ORDEN`
- `DESCARTADA`
- `CONVERTIDA_A_ORDEN`

Transiciones permitidas:

- Nueva novedad -> `PENDIENTE_REVISION`
- `PENDIENTE_REVISION` -> `RESUELTA_SIN_ORDEN`
- `PENDIENTE_REVISION` -> `DESCARTADA`
- `PENDIENTE_REVISION` -> `CONVERTIDA_A_ORDEN`

La clasificacion de la novedad debe ser un campo separado del estado, para no crear estados innecesarios.

### Justificacion breve

Estos estados cubren el flujo aprobado: el conductor reporta, el administrador revisa y decide resolver, descartar o convertir en orden.

### Impacto en base de datos o arquitectura

- Campo `estado` en `novedades`.
- Campo de clasificacion separado, si aplica.
- Relacion opcional 0..1 entre `novedad` y `orden_trabajo`.
- Restriccion o validacion para impedir mas de una orden por novedad.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Solo congela estados tecnicos para implementar RF-02 y su relacion con RF-04.

---

## 2. Estados exactos de las ordenes de trabajo

### Opcion recomendada

Decision aprobada: usar un enum tecnico `estado_orden_trabajo` con estos valores:

- `PENDIENTE_ASIGNACION`
- `ASIGNADA`
- `EN_EJECUCION`
- `COMPLETADA_TECNICO`
- `DEVUELTA_CORRECCION`
- `CERRADA`

Transiciones permitidas:

- Nueva orden sin tecnico -> `PENDIENTE_ASIGNACION`
- Nueva orden con tecnico -> `ASIGNADA`
- `PENDIENTE_ASIGNACION` -> `ASIGNADA`
- `ASIGNADA` -> `EN_EJECUCION`
- `EN_EJECUCION` -> `COMPLETADA_TECNICO`
- `COMPLETADA_TECNICO` -> `CERRADA`
- `COMPLETADA_TECNICO` -> `DEVUELTA_CORRECCION`
- `DEVUELTA_CORRECCION` -> `EN_EJECUCION`

Reglas obligatorias:

- `CERRADA` es estado terminal.
- No se permite cerrar desde `ASIGNADA` ni desde `EN_EJECUCION`.
- La reasignacion de mecanico es exclusiva del Administrador y queda auditada.
- Para pasar a `COMPLETADA_TECNICO` deben existir fechas de ejecucion y actividades realizadas.
- En ordenes correctivas, el diagnostico es obligatorio.
- El consumo de repuestos es opcional.
- El cierre definitivo es exclusivo del Administrador.

Responsabilidades:

- Administrador: crea, asigna, supervisa, devuelve para correccion, valida y cierra.
- Mecanico: inicia ejecucion, registra informacion tecnica y marca completada.

### Justificacion breve

La decision conserva la separacion obligatoria entre ejecucion tecnica y cierre administrativo. `DEVUELTA_CORRECCION` cubre la alternativa documentada donde el administrador devuelve una orden para ajuste sin cerrar el flujo.

### Impacto en base de datos o arquitectura

- Campo `estado` en `ordenes_trabajo`.
- Validacion de transiciones en servicio backend.
- Auditoria minima de responsable y fecha en cambios criticos.
- Cierre condicionado a informacion tecnica minima.
- Registro auditado de reasignaciones de mecanico.
- Validacion de fechas de ejecucion, actividades y diagnostico segun tipo de orden.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Solo concreta la maquina de estados requerida para RF-04.

---

## 3. Criterio de mantenimiento proximo

### Opcion recomendada

Decision aprobada: configurar umbrales documentados:

- Por fecha: mantenimiento proximo si `fechaProgramada` esta entre hoy y los proximos 7 dias calendario.
- Por kilometraje: mantenimiento proximo si faltan 500 km o menos para `kilometrajeObjetivo`, sin haberlo alcanzado o superado.
- Vencido por fecha: `fechaProgramada` anterior a hoy.
- Vencido por kilometraje: `kilometrajeActual >= kilometrajeObjetivo`.

Para criterios combinados:

- `VENCIDO` si cualquiera de los criterios aplicables esta vencido.
- `PROXIMO` si ninguno esta vencido y al menos uno esta proximo.
- `VIGENTE` si no esta vencido ni proximo.

Reglas adicionales:

- Se admiten programaciones solo por fecha, solo por kilometraje o por ambos.
- No se puede generar mas de una orden activa para la misma programacion preventiva.
- Al cerrar una orden preventiva deben actualizarse la proxima fecha o el proximo kilometraje objetivo antes de permitir una nueva generacion.

Los valores deben quedar como configuracion visible del backend, por ejemplo:

- `PREVENTIVE_SOON_DAYS=7`
- `PREVENTIVE_SOON_KM=500`

### Justificacion breve

Es simple, entendible para evidencia academica y evita ocultar numeros magicos en el codigo.

### Impacto en base de datos o arquitectura

- No requiere tabla nueva.
- Requiere funcion/servicio de calculo de estado preventivo.
- Umbrales documentados en `DECISIONS.md`.
- Puede exponerse en configuracion para que el criterio sea verificable.
- Requiere validar orden activa por programacion preventiva.
- Requiere actualizar el proximo objetivo preventivo al cerrar una orden preventiva.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Solo define el criterio operativo exigido por RF-03.

---

## 4. Reglas de asignacion entre conductor y bus

### Opcion recomendada

Decision aprobada: usar una asignacion activa unica:

- Un conductor puede tener maximo un bus activo al mismo tiempo.
- Un bus puede tener maximo un conductor activo al mismo tiempo.
- Cada reasignacion conserva historial: la asignacion anterior queda con `fechaFin` y `activa=false`.
- La operacion de reasignar debe ejecutarse en transaccion.
- Un conductor sin asignacion activa no puede registrar novedad asociada a bus.
- El backend siempre determina el bus permitido desde la asignacion activa, no desde un ID enviado por el cliente.

### Justificacion breve

El proyecto no incluye gestion de turnos, rutas ni despacho. Una relacion activa unica reduce ambiguedad y facilita aplicar minimo privilegio del conductor.

### Impacto en base de datos o arquitectura

- Tabla `asignaciones_conductor`.
- Campos `fecha_inicio`, `fecha_fin`, `activa`.
- Indices unicos parciales recomendados para conductor activo y bus activo.
- Servicios backend para reasignacion transaccional.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Solo concreta la restriccion necesaria para RF-01, RF-02 y permisos del conductor.

---

## 5. ORM o acceso a PostgreSQL

### Opcion recomendada

Decision aprobada: usar Prisma ORM con PostgreSQL/Neon.

Complementar con SQL crudo versionado dentro de migraciones cuando se necesiten restricciones avanzadas, por ejemplo indices unicos parciales o checks que Prisma no exprese comodamente.

### Justificacion breve

Prisma ofrece migraciones, cliente tipado, seed y una curva de mantenimiento clara para un prototipo academico. Facilita trabajar con relaciones, transacciones y estructura modular sin escribir SQL repetitivo en toda la API.

### Impacto en base de datos o arquitectura

- `prisma/schema.prisma` como definicion principal del modelo.
- Migraciones versionadas.
- Seed de desarrollo/demo.
- Capa repository/service en backend para no mezclar Prisma directamente con rutas.
- Uso de transacciones para consumos de repuestos, reasignaciones y conversiones a orden.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Es una decision de implementacion para persistencia de RF-01 a RF-06.

---

## 6. Validacion de datos

### Opcion recomendada

Decision aprobada: usar Zod para validar entradas en backend y reutilizar esquemas o tipos en frontend cuando sea conveniente.

### Justificacion breve

Zod permite validacion declarativa, mensajes controlados y evita aceptar estructuras invalidas en la API. Encaja bien con Express y React.

### Impacto en base de datos o arquitectura

- Middlewares de validacion por endpoint.
- Validacion definitiva en backend.
- Validacion de UX en frontend sin confiar en ella como seguridad.
- Errores consistentes con formato controlado.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Apoya RNF-01 y RNF-04.

---

## 7. Autenticacion y autorizacion

### Opcion recomendada

Decision aprobada: usar autenticacion con email y contrasena, hash seguro con bcrypt, y token JWT en cookie HTTP-only.

Reglas:

- Login rechaza cuentas inactivas.
- Logout limpia cookie/token.
- Backend obtiene usuario y rol desde el token validado.
- Autorizacion por middleware de roles y por filtros de propiedad/asignacion.
- El frontend protege rutas como UX, pero el backend es la autoridad final.
- La cookie debe ser `HttpOnly`.
- `Secure=true` en produccion.
- `SameSite` se configura segun entorno.
- CORS queda restringido al dominio autorizado del frontend.
- Las operaciones de escritura deben tener proteccion CSRF o validacion equivalente.
- Debe existir limite de intentos de inicio de sesion.
- El JWT debe tener expiracion definida.
- Esta prohibido registrar contrasenas, hashes o tokens en logs.

### Justificacion breve

Es suficiente para un prototipo web academico, evita guardar tokens en `localStorage` y permite implementar cierre de sesion, rutas protegidas y roles sin servicios externos.

### Impacto en base de datos o arquitectura

- Tabla `usuarios` con `contrasena_hash`, `estado` y FK a `roles`.
- Variables de entorno para secreto y expiracion del JWT.
- Middleware `authRequired`.
- Middleware `requireRole`.
- Validaciones especificas para conductor y mecanico segun asignacion/orden.
- Configuracion CORS con credenciales si frontend y API quedan en dominios distintos.
- Variables de entorno para cookie, `SameSite`, CSRF o mecanismo equivalente, expiracion y limites de login.
- Politica de logging que excluya credenciales, hashes y tokens.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Autenticacion y permisos quedan como capacidad transversal, no como RF principal.

---

## 8. Herramientas de pruebas

### Opcion recomendada

Decision aprobada: usar:

- Vitest para pruebas unitarias.
- Supertest para pruebas de API Express.
- React Testing Library para componentes/flujos de interfaz.
- Playwright para flujos E2E criticos y validacion en Chromium/Edge cuando aplique.

### Justificacion breve

La combinacion cubre reglas de negocio, API, interfaz y los flujos E2E exigidos sin depender solo de pruebas manuales.

### Impacto en base de datos o arquitectura

- Scripts `test`, `test:api`, `test:e2e` o equivalentes.
- Base de datos de prueba o schema aislado para integracion.
- Seeds de prueba controlados.
- Evidencia alineada con `docs/TESTING.md`.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Sirve para demostrar cumplimiento de RF/RNF.

---

## 9. Lint y formato

### Opcion recomendada

Decision aprobada: usar ESLint y Prettier.

Configuracion sugerida:

- ESLint para React y Node/Express.
- Prettier para formato consistente.
- `prettier-plugin-tailwindcss` si se confirma Tailwind.
- Scripts `lint`, `format` y `format:check`.

### Justificacion breve

Reduce errores simples, mantiene consistencia y ayuda a cumplir mantenibilidad sin introducir arquitectura adicional.

### Impacto en base de datos o arquitectura

- Solo impacta tooling de desarrollo.
- No cambia runtime ni modelo de datos.
- Facilita revisiones antes de commit/push.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Apoya RNF-04.

---

## 10. Proveedor aprobado para desplegar frontend y API

### Opcion recomendada

Decision aprobada: usar Vercel para el frontend React/Vite, Render para la API Node.js/Express y Neon para PostgreSQL.

Estructura aprobada:

- Vercel para frontend React/Vite.
- Render Web Service para API Express.
- Neon PostgreSQL como base de datos.
- Variables de entorno configuradas en Vercel y Render segun corresponda.
- HTTPS provisto por Vercel y Render.

### Justificacion breve

Vercel es adecuado para publicar el frontend React/Vite, Render soporta la API Node/Express como servicio persistente y Neon queda como base PostgreSQL. Esta distribucion mantiene coherencia con el presupuesto y el documento academico.

### Impacto en base de datos o arquitectura

- Configuracion de `VITE_API_URL` para frontend.
- Configuracion de `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` y demas variables en API.
- CORS restringido al dominio real del frontend.
- Cookies, `SameSite`, `Secure` y CORS deben configurarse segun dominios reales de Vercel y Render.
- Si se usa plan gratuito en Render, considerar cold starts al evaluar RNF-03; para validacion formal conviene mantener el servicio despierto o usar un plan sin suspension.

### Confirmacion de alcance

No modifica RF, RNF, casos de uso ni alcance aprobado. Solo define infraestructura de publicacion del prototipo.

---

## Resumen de decisiones aprobadas

Quedan aprobadas para Fase 3:

1. Estados de novedades.
2. Estados de ordenes.
3. Umbrales de mantenimiento proximo.
4. Regla de asignacion conductor-bus.
5. Prisma como ORM.
6. Zod como validacion.
7. JWT en cookie HTTP-only + bcrypt para autenticacion.
8. Vitest/Supertest/React Testing Library/Playwright para pruebas.
9. ESLint/Prettier para lint y formato.
10. Vercel para frontend, Render para API y Neon para datos.

Estas decisiones no autorizan por si mismas iniciar programacion. El desarrollo comienza solo cuando el propietario indique `INICIAR FASE 3`.
