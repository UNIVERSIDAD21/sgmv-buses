# AGENTS.md

## 1. Propósito de este archivo

Este archivo es la instrucción permanente principal para cualquier agente de desarrollo que trabaje en este repositorio.

**OpenClaw participa exclusivamente en la Fase 3 del proyecto: desarrollo, integración, pruebas funcionales, corrección y preparación del prototipo.**

Las Fases 1 y 2 pertenecen al análisis y diseño del Proyecto de Grado. Sus decisiones llegan a OpenClaw como especificaciones que debe implementar, no como temas que deba redefinir.

---

## 2. Regla de alcance de OpenClaw

OpenClaw SÍ puede:

- Crear y modificar código.
- Crear migraciones y scripts de base de datos a partir del modelo aprobado.
- Implementar frontend, backend y API REST.
- Implementar autenticación y autorización por roles.
- Implementar los seis requerimientos funcionales aprobados.
- Implementar los cuatro requerimientos no funcionales aprobados.
- Crear pruebas.
- Corregir errores.
- Refactorizar sin alterar el comportamiento funcional aprobado.
- Mejorar estructura interna, legibilidad, seguridad y mantenibilidad.
- Proponer una solución técnica cuando exista más de una forma equivalente de implementar una especificación.
- Documentar decisiones técnicas de implementación en `docs/DECISIONS.md`.

OpenClaw NO puede, sin autorización explícita del propietario:

- Crear RF-07, RF-08 o cualquier requerimiento funcional adicional.
- Eliminar, fusionar o reemplazar los seis RF aprobados.
- Reintroducir "Iniciar sesión" o "Gestión de usuarios" como RF principal.
- Eliminar o cambiar los tres roles aprobados.
- Redefinir casos de uso.
- Cambiar reglas de negocio por conveniencia técnica.
- Cambiar el stack principal.
- Convertir el proyecto en una aplicación móvil nativa.
- Incorporar GPS, IoT, IA/ML, gestión de rutas, recaudo, ERP, nómina, facturación completa, multiempresa o integraciones externas no aprobadas.
- Tomar una versión académica antigua como fuente de verdad si contradice esta documentación.
- Inventar reglas críticas que no estén definidas.

### Si aparece una contradicción

Aplicar siempre:

**DETENER → IDENTIFICAR → DOCUMENTAR → CONSULTAR.**

No resolver una contradicción funcional cambiando silenciosamente el diseño.

---

## 3. Orden obligatorio de lectura

Al entrar por primera vez al repositorio, leer en este orden:

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/PROJECT_BRIEF.md`
4. `docs/REQUIREMENTS.md`
5. `docs/USE_CASES.md`
6. `docs/BUSINESS_RULES.md`
7. `docs/DATA_MODEL.md`
8. `docs/ARCHITECTURE.md`
9. `docs/DECISIONS.md`
10. `docs/TASKS.md`
11. `docs/SETUP.md`
12. `docs/TESTING.md`
13. `docs/PROMPTS.md`

Antes de una sesión posterior, como mínimo releer:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/DECISIONS.md`
- `docs/TASKS.md`

---

## 4. Jerarquía de fuente de verdad

Si dos fuentes se contradicen, prevalece este orden:

1. Instrucción explícita más reciente del propietario del proyecto.
2. `AGENTS.md`.
3. `docs/DECISIONS.md`.
4. `docs/REQUIREMENTS.md`.
5. `docs/USE_CASES.md`.
6. `docs/BUSINESS_RULES.md`.
7. `docs/DATA_MODEL.md` y `docs/ARCHITECTURE.md`.
8. `docs/PROJECT_BRIEF.md`.
9. Documentos académicos y artefactos históricos.
10. Memoria interna del agente.

**La memoria ayuda a continuar; nunca reemplaza la documentación versionada del repositorio.**

---

## 5. Uso de memoria de OpenClaw

OpenClaw tiene autorización para guardar en memoria el contexto estable de este proyecto.

En la primera lectura debe guardar como memoria estable, al menos:

- Nombre del proyecto.
- Que se trata de un prototipo académico y simulado.
- Que OpenClaw trabaja exclusivamente en la Fase 3.
- Los tres roles.
- Los seis RF finales.
- Los cuatro RNF finales.
- El stack principal.
- El alcance incluido y excluido.
- El flujo central conductor → novedad → orden → mecánico → cierre → historial.
- La regla de que autenticación es transversal y no un RF principal.
- La regla de no modificar Fase 1 o Fase 2 sin autorización.
- La ubicación de los archivos de fuente de verdad.

### Regla de sincronización de memoria

Si la memoria contradice los archivos del repositorio:

1. Conservar los archivos como verdad actual.
2. Actualizar la memoria.
3. Registrar en `docs/DECISIONS.md` cualquier decisión nueva que haya causado el cambio.

No llenar la memoria con logs efímeros, errores temporales o cada tarea menor. Para eso existen Git y `docs/TASKS.md`.

---

## 6. Identidad y alcance del sistema

**Nombre:** Software de Gestión de Mantenimiento Vehicular.

**Tipo:** prototipo funcional de plataforma web.

**Contexto:** mantenimiento preventivo y correctivo de una flota de buses urbanos, con escenario académico representativo/simulado.

**Problema central:** dispersión de información de mantenimiento y falta de trazabilidad.

**Objetivo técnico:** centralizar información y permitir gestionar flota, novedades, mantenimiento preventivo, órdenes de trabajo, repuestos, historial e informes.

---

## 7. Roles definitivos

Existen exactamente tres perfiles funcionales:

1. **Administrador / Supervisor**
2. **Personal Técnico / Mecánico**
3. **Conductor / Operador**

No crear roles funcionales adicionales sin autorización.

---

## 8. Requerimientos funcionales definitivos

Existen exactamente seis RF principales:

- **RF-01 — Gestión de la flota vehicular**
- **RF-02 — Control de novedades operativas**
- **RF-03 — Administración del mantenimiento preventivo**
- **RF-04 — Seguimiento de órdenes de trabajo**
- **RF-05 — Central de Repuestos**
- **RF-06 — Consulta de historial y generación de informes**

Autenticación, cierre de sesión, protección de rutas y administración mínima de cuentas son capacidades transversales de soporte y seguridad. **No son RF principales.**

---

## 9. Stack principal obligatorio

### Frontend
- React
- Vite
- Tailwind CSS

### Backend
- Node.js
- Express
- API REST

### Datos
- PostgreSQL
- Neon

### Arquitectura
- Cliente-servidor.
- Separación entre presentación, lógica de negocio y acceso a datos.

No cambiar el stack principal sin autorización.

Las librerías auxiliares —validación, hashing, JWT/sesiones, testing, acceso SQL/ORM— son decisiones técnicas delegables al agente siempre que:
- no cambien el alcance;
- no introduzcan servicios de pago innecesarios;
- sean mantenibles;
- se documenten en `docs/DECISIONS.md`.

---

## 10. Forma de trabajar

Para cada tarea:

1. Leer la especificación relacionada.
2. Revisar dependencias y código existente.
3. Planear el cambio mínimo coherente.
4. Implementar.
5. Validar autorización en backend, no solo en interfaz.
6. Ejecutar pruebas relacionadas.
7. Ejecutar build/lint si están configurados.
8. Revisar el diff.
9. Actualizar `docs/TASKS.md`.
10. Actualizar `docs/DECISIONS.md` si hubo decisión técnica relevante.
11. Hacer commit y push como cierre de un bloque coherente, salvo instrucción contraria.

No hacer commits parciales de código roto salvo que el propietario lo solicite explícitamente.

---

## 11. Seguridad mínima obligatoria

- Nunca almacenar contraseñas en texto plano.
- Nunca exponer secretos en Git.
- Usar variables de entorno.
- Validar entradas en backend.
- Proteger cada operación por rol en backend.
- Evitar SQL inseguro por concatenación de entradas.
- No mostrar stack traces o secretos al cliente.
- Aplicar claves primarias, foráneas, unicidad y nulabilidad donde corresponda.
- Registrar responsable y fecha en operaciones críticas.
- El Conductor/Operador nunca puede obtener información de buses no asignados ni costos/inventario/gestión administrativa.

---

## 12. Reglas de datos e historial

- No borrar información histórica necesaria para trazabilidad.
- Preferir activar/desactivar sobre eliminación destructiva cuando exista historial asociado.
- El historial del bus se construye desde información validada de órdenes/intervenciones; no debe convertirse en un formulario independiente que permita fabricar historial manual.
- Una novedad convertida en orden mantiene la relación entre ambos registros.
- Una programación preventiva que origine una orden mantiene la relación.
- Los consumos de repuestos deben mantener relación con la orden y el repuesto.
- Los movimientos que afectan inventario deben ser consistentes y trazables.

---

## 13. Prohibiciones de alcance

Fuera del prototipo:

- GPS/telemetría en tiempo real.
- Gestión de rutas, despacho o frecuencias.
- Pasajes, recaudo o pasajeros.
- IA/ML predictiva.
- IoT.
- ERP de compras/proveedores.
- Contabilidad completa.
- Nómina.
- Facturación completa.
- App móvil nativa.
- SMS/WhatsApp/push automáticos.
- Integraciones con RUNT, AMB u otros sistemas externos.
- Multiempresa.

No implementar extras "porque quedarían bien".

---

## 14. Estado de inicio

Este paquete documental puede cargarse antes de programar.

**No iniciar Fase 3 hasta recibir una instrucción explícita del propietario equivalente a: `INICIAR FASE 3`.**

Mientras no exista esa orden, OpenClaw puede:
- leer;
- guardar memoria;
- revisar consistencia;
- reportar preguntas;
- preparar un plan técnico sin modificar código de producto.
