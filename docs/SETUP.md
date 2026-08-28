# Setup

## 1. Requisitos de desarrollo

- Node.js 24.x.
- npm 11.x.
- Git.
- Acceso a una base PostgreSQL/Neon para desarrollo.
- Navegador Chrome/Edge para validación.

Decisiones tecnicas aprobadas para Fase 3:

- Prisma ORM.
- Zod.
- bcrypt.
- JWT en cookie `HttpOnly`.
- Vitest, Supertest, React Testing Library y Playwright.
- ESLint y Prettier.

---

## 2. Estructura esperada

La organización base propuesta es:

```text
PROYECTO/
├─ AGENTS.md
├─ README.md
├─ .env.example
├─ docs/
│  ├─ PROJECT_BRIEF.md
│  ├─ REQUIREMENTS.md
│  ├─ USE_CASES.md
│  ├─ BUSINESS_RULES.md
│  ├─ DATA_MODEL.md
│  ├─ ARCHITECTURE.md
│  ├─ TASKS.md
│  ├─ DECISIONS.md
│  ├─ SETUP.md
│  ├─ TESTING.md
│  ├─ PROMPTS.md
│  └─ PROJECT_STATUS.md
└─ src/
   ├─ frontend/
   └─ backend/
```

La estructura interna exacta puede ajustarse por mantenibilidad, pero debe conservar separación frontend/backend y responsabilidades por módulo.

---

## 3. Variables de entorno

Copiar `.env.example` y crear archivos locales no versionados según la estructura elegida.

Nunca subir secretos.

Variables conceptuales:

- `DATABASE_URL`
- `SEED_USER_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `CORS_ORIGIN`
- `VITE_API_URL`
- `NODE_ENV`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `CSRF_SECRET` o variable equivalente segun el mecanismo implementado
- `LOGIN_RATE_LIMIT_WINDOW_MS`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`
- `PREVENTIVE_SOON_DAYS=7`
- `PREVENTIVE_SOON_KM=500`

No registrar contrasenas, hashes ni tokens en logs.

En Neon se recomienda incluir `schema=public` en `DATABASE_URL` durante desarrollo para evitar que el pooler reutilice sesiones con un `search_path` temporal:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require&schema=public
```

---

## 4. Comandos

Instalar dependencias desde la raíz del repositorio:

```bash
npm install
```

Comandos principales:

```bash
npm run dev:frontend
npm run dev:backend
npm run lint
npm run test
npm run build
npm run format
npm run format:check
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

La estrategia de workspaces está definida en el `package.json` raíz:

- `src/frontend` corresponde a `@sgmv/frontend`.
- `src/backend` corresponde a `@sgmv/backend`.

Para validar Prisma durante el bootstrap sin una base Neon real configurada, puede usarse una URL PostgreSQL ficticia solo para validar el esquema:

```powershell
$env:DATABASE_URL='postgresql://user:password@localhost:5432/sgmv?schema=public'
npm run prisma:validate
npm run prisma:generate
```

No usar esa URL como credencial real.

---

## 5. Base de datos

Procedimiento esperado:

1. Configurar `DATABASE_URL` en `.env` local no versionado.
2. Ejecutar `npm run prisma:validate`.
3. Ejecutar `npm run prisma:migrate`.
4. Ejecutar `npm run prisma:seed` solo en entorno de desarrollo/demo cuando corresponda.
5. Verificar conectividad.
6. No ejecutar operaciones destructivas en una BD compartida sin confirmación.

El seed usa usuarios demo y genera hashes bcrypt. `SEED_USER_PASSWORD` es obligatoria, debe tener minimo 12 caracteres y no se versiona. Configurar una clave demo local con:

```bash
SEED_USER_PASSWORD=otra-clave-demo npm run prisma:seed
```

En Windows/PowerShell:

```powershell
$env:SEED_USER_PASSWORD='otra-clave-demo'
npm run prisma:seed
Remove-Item Env:\SEED_USER_PASSWORD
```

---

## 6. CORS

En desarrollo, permitir únicamente el origen frontend configurado.

En despliegue, usar el dominio real del frontend en Vercel como origen permitido para la API en Render.

Evitar `*` con credenciales si el mecanismo de autenticación no lo permite de forma segura.

Como la autenticacion usa cookie, configurar CORS con credenciales solo para el origen autorizado y ajustar `SameSite`/`Secure` segun entorno.

---

## 7. Despliegue aprobado

- Frontend React/Vite: Vercel.
- API Node.js/Express: Render.
- Base de datos PostgreSQL: Neon.

Variables esperadas:

- Vercel: `VITE_API_URL`.
- Render: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, configuracion de cookie, CSRF o equivalente, limites de login, `PREVENTIVE_SOON_DAYS` y `PREVENTIVE_SOON_KM`.

Considerar cold starts de Render si se usa plan gratuito al evaluar RNF-03.

Validacion con Neon:

- Usar schemas temporales independientes para pruebas desde cero y actualizaciones.
- No ejecutar migraciones simultaneamente sobre el mismo schema.
- `P1001` indica que Prisma no pudo establecer comunicacion con Neon o su pooler.
- `P1002` indica tiempo de espera agotado; si el mensaje menciona advisory lock, el contexto es espera de migracion, no una regla general para todos los `P1002`.
- No registrar cadenas de conexion ni secretos en logs, capturas o documentos.

---

## 8. Primer arranque del agente

Antes de instalar dependencias:

1. Leer `AGENTS.md`.
2. Revisar `PROJECT_STATUS.md`.
3. Confirmar que existe orden `INICIAR FASE 3`.
4. Si no existe, no bootstrappear código de producto.
5. Si existe, proponer breve plan de bootstrap.
6. Implementar.
7. Actualizar este archivo con los comandos reales.

---

## 9. Bootstrap técnico completado

El bootstrap técnico del repositorio quedó completado con:

- npm workspaces.
- React + Vite + Tailwind CSS en `src/frontend`.
- Node.js + Express en `src/backend`.
- Prisma ORM y Zod instalados como base técnica.
- ESLint, Prettier, Vitest, Supertest y React Testing Library.
- `.env.example` sin secretos reales.
- `schema.prisma` base sin modelos durante bootstrap, luego reemplazado por el modelo aprobado en el bloque de Persistencia.

Versiones base declaradas en el `package.json` raíz:

- Node.js 24.x.
- npm 11.x.

Advertencia conocida: npm puede mostrar `allow-scripts` para paquetes con scripts de instalación como Prisma y esbuild. No se desactiva esa protección global solo para ocultar la advertencia; se acepta mientras `npm ci`, Prisma, pruebas y build continúen funcionando correctamente.

---

## 10. Persistencia implementada y auditada

El bloque de Persistencia quedo implementado y auditado con:

- Prisma Client 6.12.0.
- PostgreSQL/Neon mediante `DATABASE_URL`.
- Migracion inicial `20260826140227_inicial_persistencia`.
- Migracion correctiva/aditiva `20260826154500_auditoria_integridad_db`.
- Migracion correctiva/aditiva `20260826163500_fija_search_path_triggers`.
- Seed de desarrollo en `src/backend/prisma/seed.ts`.
- Pruebas de integridad en `src/backend/test/prisma-integrity.test.ts`.
- Documentacion fisica en `docs/DATABASE_STRUCTURE.md` y `docs/DATA_DICTIONARY.md`.
- Diagrama fisico editable y PNG en `docs/diagrams/`.

Los comandos Prisma del workspace backend usan `dotenv-cli` para leer `.env` desde la raiz del repositorio. No copiar secretos a archivos versionados.
