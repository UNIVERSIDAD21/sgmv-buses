# Software de Gestión de Mantenimiento Vehicular

Prototipo web académico para centralizar y estandarizar la gestión del mantenimiento preventivo y correctivo de una flota de buses.

## Estado

La documentación de transferencia a desarrollo está preparada. OpenClaw participa únicamente en la **Fase 3: desarrollo, integración y validación**. El bootstrap tecnico, Persistencia, autenticacion transversal, RF-01, RF-02, la normalizacion canonica de roles, RF-03, RF-04 y RF-05 ya estan implementados, auditados y documentados. RF-06 sigue pendiente de autorizacion.

Ver `docs/PROJECT_STATUS.md` antes de iniciar cualquier implementación.

## RF-01 implementado

La Gestion de la flota vehicular esta implementada de extremo a extremo. Ver `docs/RF01_FLEET.md` para endpoints, reglas, pruebas y evidencias visuales.

## RF-02 implementado

El Control de novedades operativas esta implementado de extremo a extremo. Ver `docs/RF02_NOVEDADES.md` para endpoints, reglas, pruebas y evidencias visuales.

## RF-03 implementado

La Administracion del mantenimiento preventivo esta implementada de extremo a extremo para Administrador. Ver `docs/RF03_MANTENIMIENTO_PREVENTIVO.md` para endpoints, reglas de clasificacion, generacion de orden preventiva, pruebas y evidencias visuales.

## RF-04 implementado

El Seguimiento de ordenes de trabajo esta implementado de extremo a extremo para Administrador y Mecanico, con Conductor denegado. Ver `docs/RF04_ORDENES_TRABAJO.md` para endpoints, maquina de estados, transacciones, consumos, pruebas y evidencias visuales.

## RF-05 implementado

La Central de repuestos esta implementada de extremo a extremo para Administrador, con integracion real al consumo RF-04 del Mecanico y Conductor denegado. Ver `docs/RF05_CENTRAL_REPUESTOS.md` para endpoints, disponibilidad, entradas, ajustes, movimientos, concurrencia, pruebas y evidencias visuales.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- API: REST
- Base de datos: PostgreSQL en Neon

## Roles

- Administrador
- Mecánico
- Conductor

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
- `docs/DATABASE_STRUCTURE.md` — estructura fisica PostgreSQL/Prisma implementada.
- `docs/RF01_FLEET.md` - endpoints, reglas y evidencias de RF-01.
- `docs/RF02_NOVEDADES.md` - endpoints, reglas y evidencias de RF-02.
- `docs/RF03_MANTENIMIENTO_PREVENTIVO.md` - endpoints, reglas y evidencias de RF-03.
- `docs/RF04_ORDENES_TRABAJO.md` - endpoints, reglas y evidencias de RF-04.
- `docs/RF05_CENTRAL_REPUESTOS.md` - endpoints, reglas y evidencias de RF-05.
- `docs/DATA_DICTIONARY.md` — diccionario de datos de las 16 tablas.
- `docs/ARCHITECTURE.md` — arquitectura y límites técnicos.
- `docs/TASKS.md` — plan vivo de Fase 3.
- `docs/DECISIONS.md` — decisiones y versiones reemplazadas.
- `docs/SETUP.md` — instalación y configuración.
- `docs/TESTING.md` — estrategia y criterios de validación.
- `docs/PROMPTS.md` — prompts reutilizables.
- `docs/PROJECT_STATUS.md` — estado actual y bloqueos.

## Regla esencial

Los documentos históricos del Proyecto de Grado pueden contener versiones anteriores. Para programar, la fuente de verdad es la documentación versionada de este repositorio siguiendo la jerarquía indicada en `AGENTS.md`.
