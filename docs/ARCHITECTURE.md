# Arquitectura técnica

## 1. Arquitectura aprobada

Modelo cliente-servidor con tres responsabilidades principales:

```text
React + Vite + Tailwind
          │
          │ HTTP / JSON
          ▼
    Node.js + Express
          │
          │ SQL / capa de datos
          ▼
   PostgreSQL en Neon
```

Decisiones tecnicas aprobadas:

- Persistencia con Prisma ORM sobre PostgreSQL/Neon.
- Validacion con Zod.
- Autenticacion con email/contrasena, bcrypt y JWT en cookie `HttpOnly`.
- Pruebas con Vitest, Supertest, React Testing Library y Playwright.
- Lint/formato con ESLint y Prettier.
- Despliegue: frontend en Vercel, API en Render y datos en Neon.

---

## 2. Frontend

Responsabilidades:

- presentación;
- navegación;
- formularios;
- feedback de validación;
- consumo de API;
- adaptación visual por rol;
- protección de rutas como capa de UX.

El frontend **no es la autoridad final de seguridad**.

Organizar por módulos/feature cuando sea posible:

- auth;
- flota;
- novedades;
- preventivo;
- ordenes;
- repuestos;
- historial;
- informes.

---

## 3. Backend

Responsabilidades:

- autenticación;
- autorización;
- validación definitiva;
- reglas de negocio;
- transacciones;
- acceso a datos;
- manejo de errores;
- API REST;
- auditoría básica.

Sugerencia de capas, adaptable sin cambiar el principio:

```text
route -> controller -> service/use-case -> repository/data -> PostgreSQL
```

No colocar reglas críticas solo en controllers o componentes React.

---

## 4. Base de datos

PostgreSQL/Neon es la fuente persistente de verdad operacional.

Aplicar integridad también en base de datos cuando corresponda.

---

## 5. API REST

Usar recursos coherentes.

Ejemplos conceptuales, no contrato congelado:

```text
/api/auth
/api/usuarios
/api/buses
/api/asignaciones
/api/novedades
/api/mantenimiento-preventivo
/api/ordenes
/api/intervenciones
/api/repuestos
/api/movimientos-inventario
/api/historial
/api/informes
```

El agente puede ajustar pluralización/rutas antes de implementación siempre que documente el contrato y mantenga consistencia.

Contrato RF-03 implementado:

```text
GET    /mantenimiento-preventivo/resumen
GET    /mantenimiento-preventivo/programaciones
POST   /mantenimiento-preventivo/programaciones
GET    /mantenimiento-preventivo/programaciones/:programacionId
PATCH  /mantenimiento-preventivo/programaciones/:programacionId
POST   /mantenimiento-preventivo/programaciones/:programacionId/generar-orden
```

La capa backend queda organizada como `route -> controller -> service -> repository -> Prisma`. La clasificacion preventiva vive en un modulo reutilizable y no en componentes React. El frontend consume la API desde `src/frontend/src/features/preventivo/preventive.api.ts`.

Contrato RF-04 implementado:

```text
GET    /ordenes-trabajo/resumen
GET    /ordenes-trabajo
POST   /ordenes-trabajo
GET    /ordenes-trabajo/mis-ordenes
GET    /ordenes-trabajo/mecanicos-disponibles
GET    /ordenes-trabajo/:ordenId
GET    /ordenes-trabajo/:ordenId/historial
GET    /ordenes-trabajo/:ordenId/reasignaciones
POST   /ordenes-trabajo/:ordenId/asignar
POST   /ordenes-trabajo/:ordenId/reasignar
POST   /ordenes-trabajo/:ordenId/iniciar
POST   /ordenes-trabajo/:ordenId/reanudar
PATCH  /ordenes-trabajo/:ordenId/intervencion
POST   /ordenes-trabajo/:ordenId/actividades
GET    /ordenes-trabajo/:ordenId/repuestos-disponibles
POST   /ordenes-trabajo/:ordenId/consumos
POST   /ordenes-trabajo/:ordenId/completar
POST   /ordenes-trabajo/:ordenId/devolver
POST   /ordenes-trabajo/:ordenId/cerrar
```

RF-04 mantiene la misma separacion `route -> controller -> service -> repository -> Prisma`. La maquina de estados vive en `work-order.state.ts`, las transiciones y autorizaciones en servicio, y las operaciones criticas en transacciones Prisma. El frontend consume la API desde `src/frontend/src/features/ordenes-trabajo/work-order.api.ts`.

---

## 6. Respuestas y errores

Usar formato consistente.

Ejemplo:

```json
{
  "data": {},
  "message": "Operación realizada"
}
```

Error controlado:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "No tiene permisos para realizar esta operación"
  }
}
```

No devolver stack trace, SQL interno, tokens o secretos.

---

## 7. Autenticación

Debe existir:

- login;
- logout en términos del mecanismo escogido;
- rechazo de cuenta inactiva;
- protección de rutas;
- autorización de backend.

La decision aprobada es JWT en cookie `HttpOnly`.

Reglas obligatorias:

- `Secure=true` en produccion.
- `SameSite` segun entorno.
- CORS restringido al dominio autorizado del frontend.
- Proteccion CSRF o validacion equivalente en operaciones de escritura.
- Limite de intentos de inicio de sesion.
- Expiracion definida del JWT.
- No registrar contrasenas, hashes ni tokens en logs.

---

## 8. Autorización

No confiar en el rol enviado por el frontend.

El backend obtiene identidad/rol desde el mecanismo autenticado.

Especialmente:

- Conductor: filtrar por identidad/asignación.
- Mecánico: filtrar órdenes asignadas/autorizadas.
- Administrador: permisos administrativos.

---

## 9. Validación

Validar en:

- frontend: UX;
- backend: seguridad e integridad;
- base de datos: restricciones estructurales.

---

## 10. Configuración

Todo secreto/configuración sensible va en variables de entorno.

Usar `.env.example` sin secretos.

---

## 11. Dependencias técnicas aprobadas

OpenClaw debe usar las decisiones aprobadas salvo autorizacion posterior del propietario:

- Prisma para acceso PostgreSQL/ORM y migraciones.
- Zod para validacion.
- bcrypt para hashing.
- JWT en cookie `HttpOnly` para autenticacion.
- Vitest, Supertest, React Testing Library y Playwright para pruebas.
- ESLint y Prettier para lint/formato.

Estas decisiones:

- son compatibles con Node/Express/React/Vite;
- no cambian el stack principal;
- no introducen servicios externos fuera del alcance funcional;
- quedan documentadas en `DECISIONS.md`.

---

## 12. Despliegue

Decision aprobada:

- Frontend React/Vite publicado en Vercel.
- API Node.js/Express publicada en Render.
- PostgreSQL en Neon.
- HTTPS en Vercel y Render.
- Variables de entorno separadas por proveedor.

CORS debe restringirse al dominio autorizado del frontend en Vercel. Cookies, `Secure`, `SameSite` y CSRF deben configurarse segun la relacion real entre dominios Vercel/Render.

---

## 13. Regla de simplicidad

Este es un prototipo funcional académico.

Preferir una arquitectura limpia y suficiente sobre:

- microservicios;
- event sourcing;
- Kubernetes;
- colas distribuidas;
- infraestructura empresarial innecesaria.

No sacrificar seguridad/integridad, pero evitar sobrearquitectura.
