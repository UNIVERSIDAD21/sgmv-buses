# Setup

## 1. Requisitos de desarrollo

- Node.js en versión LTS/estable compatible con las dependencias elegidas.
- npm.
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
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `CORS_ORIGIN`
- `VITE_API_URL`
- `NODE_ENV`
- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`
- `CSRF_SECRET` o variable equivalente segun el mecanismo implementado
- `LOGIN_RATE_LIMIT_WINDOW_MS`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`
- `PREVENTIVE_SOON_DAYS=7`
- `PREVENTIVE_SOON_KM=500`

No registrar contrasenas, hashes ni tokens en logs.

---

## 4. Comandos

Los comandos concretos se completarán después del bootstrap.

Objetivo recomendado:

```bash
npm install
npm run dev
npm test
npm run build
```

Si el repositorio usa workspaces, documentar también:

```bash
npm run dev:frontend
npm run dev:backend
```

No dejar esta sección desactualizada.

---

## 5. Base de datos

Procedimiento esperado:

1. Configurar `DATABASE_URL`.
2. Ejecutar migraciones.
3. Ejecutar seed solo en entorno de desarrollo/demo cuando corresponda.
4. Verificar conectividad.
5. No ejecutar operaciones destructivas en una BD compartida sin confirmación.

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
- Render: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, configuracion de cookie, CSRF o equivalente, limites de login y umbrales preventivos.

Considerar cold starts de Render si se usa plan gratuito al evaluar RNF-03.

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
