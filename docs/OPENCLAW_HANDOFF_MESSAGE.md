# Mensaje para enviar a OpenClaw

Jefe ya consolidó conmigo la documentación que debes usar para este proyecto.

Quiero que organices el repositorio así:

```text
TU-PROYECTO/
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
│  ├─ PROJECT_STATUS.md
│  └─ HANDOFF_CHECKLIST.md
└─ src/
   ├─ frontend/
   └─ backend/
```

`AGENTS.md` debe permanecer en la raíz y debe ser el primer archivo que leas cada vez que necesites recuperar las reglas permanentes del proyecto.

En tu primera lectura, sigue exactamente el orden indicado dentro de `AGENTS.md`.

## Importante sobre tu responsabilidad

Tu participación es EXCLUSIVAMENTE la Fase 3:

- desarrollo;
- integración;
- pruebas;
- corrección;
- preparación técnica del prototipo.

No vas a redefinir Fase 1 ni Fase 2.

No debes cambiar por decisión propia:

- los tres roles;
- los seis RF;
- los cuatro RNF;
- casos de uso;
- alcance;
- reglas de negocio;
- stack principal.

Si detectas una contradicción o una especificación insuficiente para programar:

**DETENTE, DOCUMÉNTALA Y PREGUNTA.**

No la resuelvas cambiando silenciosamente el sistema.

## Memoria

Tienes autorización para guardar en tu memoria el contexto estable del proyecto.

Después de leer todos los archivos, guarda en memoria:

1. nombre y objetivo;
2. que es un prototipo académico/simulado;
3. que tú solo trabajas Fase 3;
4. tres roles;
5. seis RF;
6. cuatro RNF;
7. stack;
8. alcance incluido/excluido;
9. flujo correctivo central;
10. regla de fuente de verdad;
11. ubicación de los documentos.

Pero recuerda:

**la memoria nunca tiene prioridad sobre los archivos versionados.**

Si tu memoria y los archivos se contradicen, ganan los archivos y debes actualizar tu memoria.

Antes de cada sesión importante relee al menos:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/DECISIONS.md`
- `docs/TASKS.md`

## Versiones antiguas

No uses listas históricas de 24 RF, 52 RF u otras versiones como lista de implementación.

La línea vigente es exactamente:

- RF-01 Gestión de la flota vehicular
- RF-02 Control de novedades operativas
- RF-03 Administración del mantenimiento preventivo
- RF-04 Seguimiento de órdenes de trabajo
- RF-05 Central de Repuestos
- RF-06 Consulta de historial y generación de informes

Autenticación y gestión de acceso se programan, pero son capacidades transversales, NO un séptimo RF ni un RF principal de "Iniciar sesión".

## Lo que debes hacer ahora

1. Coloca los archivos en la estructura indicada.
2. Léelos completos.
3. Guarda el contexto estable en memoria.
4. No programes todavía.
5. Devuélveme:
   - resumen de lo que entendiste;
   - qué guardaste en memoria;
   - confirmación de los 3 roles;
   - confirmación de los 6 RF;
   - confirmación de los 4 RNF;
   - dudas/contradicciones detectadas;
   - confirmación de que esperarás la orden `INICIAR FASE 3`.

Cuando yo te dé `INICIAR FASE 3`, empiezas por `docs/TASKS.md` y sigues las reglas de `AGENTS.md`.
