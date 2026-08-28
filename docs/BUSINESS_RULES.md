# Reglas de negocio

## BR-01 — Roles

El sistema trabaja con exactamente tres perfiles funcionales:

- Administrador
- Mecánico
- Conductor

---

## BR-02 — Autenticación transversal

La autenticación es necesaria para operar el sistema protegido, pero no constituye uno de los seis RF principales.

Las cuentas inactivas no pueden acceder.

La autenticacion aprobada usa cookie `HttpOnly`, `Secure=true` en produccion, `SameSite` segun entorno, JWT con expiracion definida, CORS restringido al dominio autorizado del frontend, limite de intentos de inicio de sesion y proteccion CSRF o validacion equivalente para operaciones de escritura.

Nunca registrar contrasenas, hashes o tokens en logs.

---

## BR-03 — Autorización en servidor

Ocultar un botón no es seguridad.

Toda operación restringida debe validarse también en backend.

---

## BR-04 — Mínimo privilegio del conductor

El Conductor solo puede consultar información autorizada del bus asociado a su asignación activa y sus propias novedades.

No puede consultar:

- otros buses;
- usuarios;
- inventario administrativo;
- costos;
- órdenes administrativas;
- datos internos no requeridos para su rol.

---

## BR-05 — Identificación única del bus

La identificación definida como única —placa y/o código interno según la migración final— no admite duplicados.

No eliminar un bus si eso destruye trazabilidad histórica; usar estado cuando corresponda.

---

## BR-06 — Asignación conductor-bus

El sistema debe conservar historial de asignaciones.

Debe existir una forma inequívoca de determinar cuál asignación está activa para aplicar los permisos del conductor.

Regla aprobada:

- Un conductor puede tener maximo un bus activo al mismo tiempo.
- Un bus puede tener maximo un conductor activo al mismo tiempo.
- Cada reasignacion conserva historial: la asignacion anterior queda con `fechaFin` y `activa=false`.
- La reasignacion se ejecuta en transaccion.
- El backend determina el bus permitido desde la asignacion activa, no desde un ID enviado por el cliente.

---

## BR-07 — Novedad

Al registrar una novedad:

- autor se obtiene de la sesión;
- bus se obtiene de una asignación válida;
- fecha/hora la genera el sistema;
- tipo y descripción son obligatorios;
- se guarda estado.

No confiar en IDs enviados por el cliente para autorizar bus/usuario sin validación del servidor.

---

## BR-08 — Seguimiento de novedad

El conductor solo consulta sus propias novedades y el estado que el sistema tenga registrado.

---

## BR-09 — Conversión novedad → orden

Una novedad puede originar como máximo la orden asociada definida por el flujo aprobado.

La conversión conserva la relación entre novedad y orden y debe ser idempotente ante reintentos razonables para evitar duplicados accidentales.

En RF-02 la prioridad no pertenece a la novedad porque el modelo fisico no tiene ese campo en `novedades`. La prioridad se define solo al crear la `OrdenTrabajo` correctiva asociada.

---

## BR-10 — Preventivo

Una programación preventiva pertenece a un bus e identifica una actividad y un criterio.

Criterios:

- fecha;
- kilometraje;
- ambos.

Implementacion:

- El Administrador autenticado es el unico actor que crea, consulta, reprograma y genera ordenes desde programaciones preventivas.
- El bus debe existir y no puede estar `INACTIVO`.
- El sistema toma `kilometrajeActual` desde `buses.kilometraje_actual`; el cliente no puede enviarlo.
- El cliente no puede enviar creador, responsable ni clasificacion calculada.

---

## BR-11 — Estado preventivo

El sistema distingue:

- `VIGENTE`;
- `PROXIMO`;
- `VENCIDO`.

Umbrales aprobados:

- Por fecha: `PROXIMO` si faltan 7 dias calendario o menos para `fechaProgramada`.
- Por kilometraje: `PROXIMO` si faltan 500 km o menos para `kilometrajeObjetivo`.
- Por fecha: `VENCIDO` si `fechaProgramada` es anterior a hoy.
- Por kilometraje: `VENCIDO` si `kilometrajeActual >= kilometrajeObjetivo`.

Formula aprobada:

- `VENCIDO` si cualquiera de los criterios aplicables esta vencido.
- `PROXIMO` si ninguno esta vencido y al menos uno esta dentro del umbral.
- `VIGENTE` si no esta vencido ni proximo.

Implementacion:

- La regla vive centralizada en `src/backend/src/preventive/preventive.classification.ts`.
- Los umbrales se leen desde `PREVENTIVE_SOON_DAYS` y `PREVENTIVE_SOON_KM`.
- La zona horaria operacional documentada es `America/Bogota`.
- Las fechas objetivo preventivas son `date`; se comparan como dias calendario para evitar cambios prematuros por UTC.
- La fecha actual se obtiene en servidor.

---

## BR-12 — Programación → orden

Una programación que origine una orden preventiva conserva su relación.

No se puede generar mas de una orden activa para la misma programacion preventiva.

Al cerrar una orden preventiva deben actualizarse la proxima fecha o el proximo kilometraje objetivo cuando existan intervalos fisicos aprobados para calcularlos.

Implementacion RF-03:

- Una programacion `VIGENTE` no genera orden preventiva.
- Una programacion `PROXIMO` o `VENCIDO` puede generar orden preventiva.
- La orden generada por RF-03 queda en `PENDIENTE_ASIGNACION`, con `origen=PREVENTIVO`, `tipo=PREVENTIVA`, el mismo bus de la programacion y sin Mecanico asignado.
- La creacion de orden e historial inicial se ejecuta en una unica transaccion.
- El indice unico parcial de orden preventiva activa por programacion evita duplicados tambien ante solicitudes simultaneas.
- RF-04 conserva la orden cerrada y sus objetivos copiados. La actualizacion automatica del siguiente objetivo no se ejecuta en la implementacion actual porque el modelo fisico vigente no contiene campos de intervalo preventivo.

---

## BR-13 — Origen de orden

Una orden puede originarse, como mínimo, por:

- preventivo;
- correctivo directo;
- novedad.

El origen debe quedar almacenado.

---

## BR-14 — Separación de responsabilidades en orden

Administrador:

- crea/asigna/supervisa;
- valida;
- cierra.

Mecánico:

- ejecuta;
- registra información técnica;
- marca trabajo completado.

La ejecución técnica y el cierre administrativo no se confunden.

---

## BR-15 — Estados de orden

La orden debe usar una máquina de estados explícita.

No permitir transiciones arbitrarias.

Estados aprobados:

- `PENDIENTE_ASIGNACION`
- `ASIGNADA`
- `EN_EJECUCION`
- `COMPLETADA_TECNICO`
- `DEVUELTA_CORRECCION`
- `CERRADA`

Transiciones permitidas:

- Nueva orden sin tecnico -> `PENDIENTE_ASIGNACION`
- Nueva orden con tecnico -> `ASIGNADA`
- `PENDIENTE_ASIGNACION` -> `ASIGNADA`
- `ASIGNADA` -> `EN_EJECUCION`
- `EN_EJECUCION` -> `COMPLETADA_TECNICO`
- `COMPLETADA_TECNICO` -> `CERRADA`
- `COMPLETADA_TECNICO` -> `DEVUELTA_CORRECCION`
- `DEVUELTA_CORRECCION` -> `EN_EJECUCION`

`CERRADA` es terminal. No se permite cerrar desde `ASIGNADA` ni desde `EN_EJECUCION`.

La reasignacion de mecanico es exclusiva del Administrador y queda auditada.

Implementacion RF-04:

- Las transiciones se validan en `work-order.state.ts`.
- Toda transicion real registra `orden_estado_historial`.
- La reasignacion se permite en `ASIGNADA`, `EN_EJECUCION` y `DEVUELTA_CORRECCION`; se rechaza en `COMPLETADA_TECNICO` y `CERRADA`.
- Si se reasigna durante `EN_EJECUCION`, se conserva el estado, se cierra la intervencion activa del mecanico anterior y se abre una nueva intervencion para el mecanico vigente.

---

## BR-16 — Cierre de orden

No cerrar una orden sin la información técnica mínima requerida.

El cierre registra fecha y responsable.

Para marcar una orden como `COMPLETADA_TECNICO` deben existir fechas de ejecucion y actividades realizadas.

En ordenes correctivas, el diagnostico es obligatorio.

El consumo de repuestos es opcional.

El cierre definitivo es exclusivo del Administrador.

Implementacion RF-04:

- El completado tecnico lo ejecuta solo el Mecanico asignado.
- El cierre administrativo lo ejecuta solo el Administrador desde `COMPLETADA_TECNICO`.
- El cierre valida actividades, diagnostico correctivo, consumos/movimientos y costo basico.
- Una orden cerrada queda inmutable.

---

## BR-17 — Historial

El historial no es un registro manual independiente.

Se construye a partir de información validada relacionada con el bus, especialmente órdenes cerradas, intervenciones y consumos.

---

## BR-18 — Inventario

Un movimiento de inventario registra:

- repuesto;
- tipo;
- cantidad;
- fecha;
- responsable;
- motivo cuando aplique.

---

## BR-19 — Consumo de repuesto

Un consumo debe estar relacionado con una orden y un repuesto.

La cantidad debe ser válida.

El consumo y el descuento de stock deben ocurrir en una operación consistente/atómica.

Implementacion RF-04:

- El consumo solo se permite al Mecanico asignado con orden en `EN_EJECUCION`.
- El costo unitario proviene del servidor.
- Cada consumo aplicado genera exactamente un movimiento `CONSUMO`.
- `clave_idempotencia` protege doble envio de consumo.
- Las transacciones usan candados advisory por orden/repuesto y actualizaciones condicionales de estado/stock para impedir stock negativo o transiciones duplicadas bajo concurrencia.

---

## BR-20 — Permisos de inventario

Administrador puede registrar entradas y ajustes.

Mecánico puede consultar y registrar consumo durante una intervención autorizada, pero no realizar ajustes administrativos.

---

## BR-21 — Costos

El prototipo maneja costos básicos relacionados con mantenimiento.

No convertir esta funcionalidad en contabilidad, compras o facturación.

Como mínimo, los consumos pueden aportar subtotales basados en cantidad y costo unitario disponible.

Cualquier costo adicional debe mantenerse dentro del alcance aprobado y documentarse.

---

## BR-22 — Auditoría básica

Las operaciones críticas deben conservar, cuando corresponda:

- fecha de creación;
- fecha de actualización;
- usuario responsable.

No es necesario construir un SIEM ni una plataforma empresarial de auditoría.

---

## BR-23 — Borrado

Preferir desactivación/estado sobre borrado destructivo cuando un registro tenga dependencias históricas.

---

## BR-24 — Reportes

Los informes consultan datos existentes.

No modificar datos durante la generación.

No generar predicciones.

---

## BR-25 — Alcance estricto

Una mejora visual o técnica puede implementarse si no crea un nuevo proceso de negocio.

Una nueva capacidad de negocio requiere autorización previa.
