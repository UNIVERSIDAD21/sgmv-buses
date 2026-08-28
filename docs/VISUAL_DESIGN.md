# Diseno visual oficial

**Estado:** integrado como base visual oficial del SGMV para autenticacion, panel por rol, navegacion principal y estados pendientes de RF.

## Fuente aprobada

La interfaz seleccionada proviene del ZIP exportado desde Figma Make:

`C:\Users\ING-ERIK\Downloads\Create it.zip`

SHA-256 auditado:

`F1A2FD90D27FA735A95E8E8C1BC4EE28F3D5C858C6D1717524C6F73B5F78759F`

El ZIP se usa solo como referencia visual y fuente selectiva de componentes. No se copian configuraciones, lockfiles, agentes, planes, tipos conceptuales ni datos simulados del ZIP.

## Identidad conservada

- Estilo minimalista, modular y academico.
- Paleta blanca, gris, esmeralda y verde azulado.
- Jerarquia tipografica sobria con pila segura del proyecto, sin depender obligatoriamente de Google Fonts.
- Menu lateral colapsable, con expansion suficiente para mostrar nombres oficiales completos.
- Tooltips accesibles cuando el menu esta colapsado.
- Encabezado contextual con fecha dinamica `es-CO`.
- Tarjetas, insignias, formularios, tablas visuales y paneles laterales con radios contenidos.
- Estados de carga, error, vacio y exito.
- Pie visible: "Prototipo académico — Datos simulados".
- Sin modo oscuro en este bloque.

## Integracion real

| Elemento visual | Destino real | Decision |
| --- | --- | --- |
| Shell con sidebar | `src/frontend/src/components/layout/AppShell.tsx` | Adaptado a React Router y roles reales. |
| Iconografia | `src/frontend/src/components/ui/Icons.tsx` | Adaptada como set local liviano, sin dependencia vulnerable nueva. |
| Botones e insignias | `src/frontend/src/components/ui/Button.tsx`, `Badge.tsx` | Reutilizados como primitivas del proyecto. |
| Estados visuales | `StatePanel.tsx`, `StatCard.tsx` | Adaptados para carga, error, vacio y modulos pendientes. |
| Login | `src/frontend/src/features/auth/LoginPage.tsx` | Convertido a autenticacion real contra `/auth/login`. |
| Panel por rol | `src/frontend/src/features/dashboard/DashboardPage.tsx` | Adaptado a permisos oficiales y sin datos falsos de Neon. |
| Vista de flota | `src/frontend/src/features/flota/FleetPage.tsx` | Base visual sin CRUD RF-01 completo. |
| Formulario de buses | `src/frontend/src/features/flota/BusFormPage.tsx` | Base visual deshabilitada hasta implementar RF-01. |
| Modulos pendientes | `src/frontend/src/features/modules/PendingModulePage.tsx` | Estado vacio honesto para RF no implementados. |

## Elementos rechazados del ZIP

- `.figma/`.
- `AGENTS.md`, `CLAUDE.md` y `plans/`.
- `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json` e `index.html`.
- `src/data/mock.ts`.
- `src/types.ts`.
- Enums conceptuales del prototipo.
- Navegacion basada solo en `useState`.
- Accesos directos por rol.
- Confirmaciones falsas con `setTimeout`.
- Fechas estaticas de 2024.
- Dependencias vulnerables o innecesarias detectadas en la auditoria aislada del ZIP.

## Reglas visuales vigentes

Los seis RF deben mostrarse siempre con sus nombres oficiales:

- RF-01 — Gestión de la flota vehicular.
- RF-02 — Control de novedades operativas.
- RF-03 — Administración del mantenimiento preventivo.
- RF-04 — Seguimiento de órdenes de trabajo.
- RF-05 — Central de Repuestos.
- RF-06 — Consulta de historial y generación de informes.

RF-01, RF-02 y RF-03 ya usan endpoints reales. Los modulos pendientes RF-04, RF-05 y RF-06 mantienen estados vacios o "Modulo pendiente de implementacion" mientras no exista endpoint real, y no presentan datos como si vinieran de Neon.

RF-03 conserva la interfaz oficial: panel administrativo denso, resumen, tabla, filtros, formularios y dialogos conectados a la API real, sin datos simulados ni `setTimeout`.

## Cobertura frontend

`src/frontend/src/App.test.tsx` cubre:

- inicio de sesion;
- recuperacion de sesion;
- estado de carga durante recuperacion de sesion;
- sesion expirada;
- cierre de sesion;
- rutas protegidas;
- rutas inexistentes autenticadas;
- acceso denegado;
- menus correctos para Administrador, Mecánico y Conductor;
- manejo de error de login.

## Capturas de referencia

- `docs/screenshots/auth-login.png`.
- `docs/screenshots/panel-admin.png`.
- `docs/screenshots/panel-mecanico.png`.
- `docs/screenshots/panel-conductor.png`.
- `docs/screenshots/panel-admin-mobile.png`.

## Capturas de auditoria final

- `docs/screenshots/audit-login-1440.png`.
- `docs/screenshots/audit-panel-admin-1440.png`.
- `docs/screenshots/audit-panel-admin-1024.png`.
- `docs/screenshots/audit-panel-mecanico-1440.png`.
- `docs/screenshots/audit-panel-conductor-1440.png`.
- `docs/screenshots/audit-login-mobile-390.png`.
- `docs/screenshots/audit-menu-mobile-390.png`.
- `docs/screenshots/audit-access-denied-1440.png`.
- `docs/screenshots/audit-sidebar-collapsed-tooltip.png`.

La auditoria final de interfaz oficial y autenticacion queda registrada en `docs/AUTH_UI_FINAL_AUDIT.md`.
