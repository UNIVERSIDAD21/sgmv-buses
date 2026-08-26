# Software de Gestión de Mantenimiento Vehicular

Prototipo web académico para centralizar y estandarizar la gestión del mantenimiento preventivo y correctivo de una flota de buses.

## Estado

La documentación de transferencia a desarrollo está preparada. OpenClaw participa únicamente en la **Fase 3: desarrollo, integración y validación**.

Ver `docs/PROJECT_STATUS.md` antes de iniciar cualquier implementación.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- API: REST
- Base de datos: PostgreSQL en Neon

## Roles

- Administrador / Supervisor
- Personal Técnico / Mecánico
- Conductor / Operador

## Requerimientos funcionales principales

1. RF-01 — Gestión de la flota vehicular.
2. RF-02 — Control de novedades operativas.
3. RF-03 — Administración del mantenimiento preventivo.
4. RF-04 — Seguimiento de órdenes de trabajo.
5. RF-05 — Central de Repuestos.
6. RF-06 — Consulta de historial y generación de informes.

## Documentación para el agente

Leer primero `AGENTS.md`.

Documentos principales:

- `docs/PROJECT_BRIEF.md` — contexto y alcance.
- `docs/REQUIREMENTS.md` — RF/RNF finales.
- `docs/USE_CASES.md` — seis casos de uso principales.
- `docs/BUSINESS_RULES.md` — reglas que el código debe respetar.
- `docs/DATA_MODEL.md` — modelo conceptual derivado del diseño aprobado.
- `docs/ARCHITECTURE.md` — arquitectura y límites técnicos.
- `docs/TASKS.md` — plan vivo de Fase 3.
- `docs/DECISIONS.md` — decisiones y versiones reemplazadas.
- `docs/SETUP.md` — instalación y configuración.
- `docs/TESTING.md` — estrategia y criterios de validación.
- `docs/PROMPTS.md` — prompts reutilizables.
- `docs/PROJECT_STATUS.md` — estado actual y bloqueos.

## Regla esencial

Los documentos históricos del Proyecto de Grado pueden contener versiones anteriores. Para programar, la fuente de verdad es la documentación versionada de este repositorio siguiendo la jerarquía indicada en `AGENTS.md`.
