# Prompts reutilizables para OpenClaw

## Regla

Los prompts de este archivo son plantillas operativas.

**No reemplazan `AGENTS.md`, `DECISIONS.md` ni `REQUIREMENTS.md`.**

Una instrucción antigua guardada aquí no tiene prioridad sobre una decisión más reciente.

---

# 1. Prompt de carga inicial y memoria

```text
Lee AGENTS.md y todos los documentos obligatorios indicados allí en el orden establecido.

No programes todavía.

Construye una comprensión del proyecto centrada exclusivamente en Fase 3 y guarda en tu memoria estable:
- nombre y objetivo del sistema;
- carácter académico/simulado;
- que tú solo desarrollas Fase 3;
- tres roles;
- seis RF vigentes;
- cuatro RNF;
- stack;
- alcance excluido;
- flujo correctivo central;
- reglas de fuente de verdad.

Después compara tu memoria con docs/DECISIONS.md y docs/PROJECT_STATUS.md.

Si detectas contradicciones entre documentos, no las resuelvas por tu cuenta: repórtalas con archivo, sección, impacto y pregunta concreta.

Al final responde:
1. qué entendiste;
2. qué quedó guardado en memoria;
3. si existe algún bloqueo;
4. confirma que no iniciarás código hasta recibir INICIAR FASE 3.
```

---

# 2. Prompt para iniciar Fase 3

```text
INICIAR FASE 3.

Antes de tocar código:
1. relee AGENTS.md, PROJECT_STATUS.md, DECISIONS.md y TASKS.md;
2. revisa el estado real del repositorio;
3. identifica el primer bloque pendiente;
4. presenta un plan breve de implementación;
5. implementa sin redefinir RF, roles, casos de uso ni alcance.

Al terminar el bloque:
- ejecuta pruebas pertinentes;
- ejecuta build/lint disponibles;
- revisa diff;
- actualiza TASKS.md;
- actualiza DECISIONS.md si tomaste una decisión técnica relevante;
- haz commit y push salvo instrucción contraria;
- informa cambios, pruebas y cualquier pendiente.
```

---

# 3. Prompt para implementar un RF

```text
Implementa el siguiente requerimiento usando exclusivamente la especificación vigente del repositorio: [RF-XX].

Lee:
- docs/REQUIREMENTS.md;
- el CU correspondiente en docs/USE_CASES.md;
- docs/BUSINESS_RULES.md;
- docs/DATA_MODEL.md;
- docs/TESTING.md.

Antes de implementar, identifica:
- actores y permisos;
- entidades;
- endpoints;
- validaciones;
- transacciones;
- casos de prueba.

No agregues funcionalidades fuera del RF.

Implementa frontend + backend + datos necesarios para un flujo vertical funcional.

Después ejecuta sus pruebas, actualiza TASKS.md y reporta el resultado.
```

---

# 4. Prompt para corregir un bug

```text
Corrige este error sin alterar el alcance funcional aprobado:

[PEGAR ERROR]

Procedimiento:
1. reproduce;
2. identifica causa raíz;
3. revisa si afecta una regla de negocio;
4. aplica el cambio mínimo correcto;
5. agrega o ajusta prueba para evitar regresión;
6. ejecuta pruebas relacionadas;
7. revisa diff.

No uses el bug como motivo para rediseñar RF, roles o arquitectura sin autorización.
```

---

# 5. Prompt para revisión antes de commit

```text
Revisa el bloque actual antes del commit.

Comprueba:
- que no se añadió alcance;
- autorización backend;
- validación de datos;
- integridad;
- secretos;
- errores controlados;
- pruebas;
- build;
- documentación;
- TASKS.md.

Muestra un resumen del diff y cualquier riesgo.

Si todo está correcto, realiza commit y push según las reglas del proyecto.
```

---

# 6. Prompt para solicitar una decisión

```text
Encontré una ambigüedad que afecta implementación y no debe resolverse inventando una regla.

Presenta:
- qué especificación está involucrada;
- archivos/secciones;
- opciones técnicamente posibles;
- impacto de cada opción;
- recomendación técnica;
- pregunta exacta que debe responder el propietario.

No implementes la parte bloqueada hasta recibir respuesta.
```

---

# 7. Prompt para sincronizar memoria

```text
Relee AGENTS.md, DECISIONS.md, PROJECT_STATUS.md y TASKS.md.

Compara esos archivos con lo que tienes guardado en memoria sobre este proyecto.

Si la memoria está desactualizada:
- actualízala usando los archivos como fuente de verdad;
- no reescribas los archivos a partir de una memoria antigua.

Confirma brevemente qué cambió en tu memoria.
```
