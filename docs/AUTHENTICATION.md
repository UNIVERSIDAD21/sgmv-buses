# Autenticacion y autorizacion

**Estado:** implementado como capacidad transversal de Fase 3. No crea un RF adicional.

## Estrategia aprobada

El SGMV usa autenticacion por correo y contrasena, hash `bcrypt`, JWT firmado y cookie `HttpOnly`.

- El frontend nunca guarda tokens ni credenciales en `localStorage`.
- La cookie de sesion usa el nombre configurable `COOKIE_NAME`, por defecto `sgmv_session`.
- En produccion `COOKIE_SECURE=true` es obligatorio.
- `COOKIE_SAMESITE` se configura por entorno; desarrollo usa `lax`.
- CORS queda restringido a `CORS_ORIGIN` y permite credenciales.
- Las escrituras de autenticacion validan el encabezado `Origin` como proteccion equivalente en este bloque. Las escrituras futuras de RF deben aplicar la misma validacion o CSRF especifico antes de exponerse.

## Variables de entorno

Las variables se documentan en `.env.example`; los valores reales no se versionan.

- `DATABASE_URL`: conexion PostgreSQL/Neon.
- `JWT_SECRET`: secreto largo para firmar sesiones.
- `JWT_EXPIRES_IN`: duracion de sesion, por ejemplo `1h`.
- `COOKIE_NAME`: nombre de cookie de sesion.
- `COOKIE_SECURE`: `true` en produccion.
- `COOKIE_SAMESITE`: `lax`, `strict` o `none`.
- `CORS_ORIGIN`: origen autorizado del frontend.
- `LOGIN_RATE_LIMIT_WINDOW_MS`: ventana temporal de intentos.
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`: maximo de intentos fallidos.

## Endpoints

| Metodo | Ruta | Sesion | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | No requerida | Valida credenciales, rechaza usuarios inactivos, aplica limite de intentos y crea cookie `HttpOnly`. |
| `GET` | `/auth/me` | Requerida | Recupera la sesion activa y devuelve usuario sanitizado. |
| `POST` | `/auth/logout` | No requerida | Limpia la cookie de sesion. |

Las respuestas de usuario no incluyen `contrasenaHash`, contrasenas ni tokens.

## Componentes backend

- `src/backend/src/auth/auth.routes.ts`: rutas de autenticacion.
- `src/backend/src/auth/auth.controller.ts`: entrada HTTP y cookies.
- `src/backend/src/auth/auth.service.ts`: login, bloqueo temporal, sesion y sanitizacion.
- `src/backend/src/auth/auth.repository.ts`: acceso a `Usuario` y `Rol`.
- `src/backend/src/auth/token.service.ts`: emision y verificacion JWT HS256.
- `src/backend/src/auth/auth.middleware.ts`: `authenticate`, `authorizeRoles` y validacion de `Origin`.
- `src/backend/src/auth/auth.schemas.ts`: validacion Zod.

## Autorizacion por rol

La autorizacion final vive en backend con `authorizeRoles(...)`. El frontend tambien filtra rutas, menus y vistas por rol, pero solo como experiencia de usuario.

- `ADMINISTRADOR`: RF-01 a RF-06.
- `MECANICO`: RF-04, RF-05 y RF-06 tecnico.
- `CONDUCTOR`: RF-01 limitado a bus asignado, RF-02 propio y RF-06 resumen autorizado.

No se aceptan alias como `SUPERVISOR`, `OPERADOR`, `OPERARIO`, `TECNICO`, `ADMIN_SUPERVISOR` o `CONDUCTOR_OPERADOR` en tokens, DTO ni reglas de autorizacion.

## Reglas de seguridad implementadas

- Hash `bcrypt` para contrasenas almacenadas.
- Normalizacion de email a minusculas antes del login.
- Rechazo uniforme de credenciales invalidas.
- Rechazo de usuario inactivo.
- Bloqueo temporal por intentos fallidos persistido en `Usuario`.
- Limite en memoria para correos inexistentes.
- Cookie `HttpOnly` con expiracion de JWT.
- CORS con credenciales limitado a un origen.
- Errores seguros sin exponer detalles internos ni hashes.

## Cobertura de pruebas

`src/backend/test/auth.test.ts` cubre:

- inicio valido;
- contrasena incorrecta;
- usuario inexistente;
- usuario inactivo;
- bloqueo temporal por intentos repetitivos;
- acceso sin sesion;
- cookie de sesion malformada;
- cookie de sesion expirada;
- consulta de sesion;
- existencia de solo tres roles canonicos y rechazo de alias heredados;
- rol no autorizado;
- cierre de sesion;
- respuestas sin contrasena ni hash.

La auditoria final de interfaz y autenticacion queda registrada en `docs/AUTH_UI_FINAL_AUDIT.md`.
