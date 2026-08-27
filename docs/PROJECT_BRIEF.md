# Project Brief

## 1. Qué es

**Software de Gestión de Mantenimiento Vehicular** es un prototipo funcional de plataforma web orientado a centralizar y estandarizar la información relacionada con el mantenimiento preventivo y correctivo de buses.

Es un proyecto académico. El escenario utilizado para el levantamiento inicial es representativo y simulado; no debe presentarse en el producto como si existiera una integración operativa real con una empresa de transporte específica.

---

## 2. Problema que resuelve

El problema central es la dispersión de registros de mantenimiento en medios como:

- papel;
- hojas de cálculo;
- archivos locales;
- comunicaciones informales.

Esa dispersión dificulta conocer con certeza:

- qué intervenciones ha recibido un bus;
- cuándo se realizaron;
- quién fue responsable;
- qué repuestos se utilizaron;
- qué fallas se han repetido;
- qué mantenimientos están próximos o vencidos;
- qué costos básicos se han generado.

El prototipo debe convertir esos datos en un flujo centralizado y trazable.

---

## 3. Objetivo del sistema

Construir una plataforma web que permita:

- gestionar la flota;
- registrar fallas/novedades provenientes de la operación;
- programar mantenimiento preventivo;
- gestionar órdenes correctivas y preventivas;
- registrar las intervenciones del personal técnico;
- controlar repuestos e insumos de forma básica;
- construir historial por bus;
- generar informes filtrables para seguimiento.

---

## 4. Usuarios principales

### Administrador

Coordina y controla el proceso.

Responsabilidades principales:

- gestionar buses;
- registrar/actualizar datos operativos;
- gestionar asignaciones conductor-bus;
- revisar novedades;
- programar preventivos;
- crear y asignar órdenes;
- supervisar estados;
- validar/cerrar órdenes;
- gestionar inventario;
- consultar historial;
- generar informes;
- gestionar cuentas de acceso como capacidad transversal.

### Mecánico

Ejecuta el trabajo técnico.

Responsabilidades principales:

- consultar órdenes asignadas;
- consultar antecedentes del bus;
- iniciar trabajo;
- registrar diagnóstico;
- registrar actividades;
- registrar observaciones;
- consultar disponibilidad de repuestos;
- registrar consumos vinculados a la orden;
- marcar el trabajo como completado para revisión/cierre.

No realiza cierre administrativo final ni ajustes administrativos de inventario.

### Conductor

Perfil de acceso limitado.

Puede:

- consultar información básica del bus asignado;
- consultar estado operativo;
- consultar resumen de historial permitido;
- consultar próximo mantenimiento cuando aplique;
- reportar fallas/novedades de su bus;
- consultar el estado de sus propios reportes.

No puede:

- consultar otros buses;
- administrar órdenes;
- administrar inventario;
- consultar costos administrativos;
- gestionar usuarios;
- cerrar trabajos.

---

## 5. Flujo central correctivo

1. El Conductor detecta una novedad.
2. La registra asociada a su bus.
3. El Administrador revisa la novedad.
4. La clasifica.
5. Puede resolverla/descartarla o convertirla en orden correctiva.
6. Si se convierte, la relación novedad → orden se conserva.
7. El Administrador asigna un Mecánico.
8. El Mecánico consulta antecedentes.
9. Inicia el trabajo.
10. Registra diagnóstico, actividades, observaciones y repuestos usados.
11. Marca el trabajo como completado.
12. El Administrador valida y cierra.
13. La información alimenta el historial del bus.
14. El Conductor puede consultar el estado actualizado de su reporte.

---

## 6. Flujo central preventivo

1. El Administrador crea una programación preventiva.
2. La programación utiliza fecha, kilometraje o ambos criterios.
3. El sistema determina su estado operativo de seguimiento.
4. Cuando corresponda, se genera una orden preventiva.
5. Se asigna un Mecánico.
6. El Mecánico ejecuta y registra la intervención.
7. El Administrador valida y cierra.
8. La intervención alimenta el historial del bus.

---

## 7. Módulos del prototipo

- Acceso y autorización transversal.
- Flota.
- Novedades.
- Mantenimiento preventivo.
- Órdenes de trabajo.
- Intervenciones.
- Repuestos e inventario básico.
- Historial.
- Informes/reportes.

Los módulos técnicos no equivalen necesariamente a RF separados.

---

## 8. Incluido

- Aplicación web.
- Autenticación.
- Autorización por roles.
- Gestión de buses.
- Asignación conductor-bus.
- Reporte y seguimiento de novedades.
- Preventivos por fecha/kilometraje.
- Órdenes preventivas y correctivas.
- Intervenciones técnicas.
- Historial por bus.
- Inventario básico.
- Costos básicos asociados al mantenimiento.
- Informes y paneles básicos.
- Auditoría básica de acciones críticas.

---

## 9. Fuera de alcance

- GPS.
- Telemetría.
- IoT.
- Predicción con IA/ML.
- Gestión de rutas.
- Despacho.
- Frecuencias.
- Recaudo/pasajes.
- Gestión de pasajeros.
- ERP.
- Compras/proveedores completos.
- Contabilidad completa.
- Nómina.
- Facturación completa.
- Aplicación móvil nativa.
- SMS/WhatsApp/push automáticos.
- RUNT/AMB u otras integraciones externas.
- Multiempresa.

---

## 10. Criterio de éxito del prototipo

El cierre funcional requiere que los flujos principales de los seis RF puedan completarse de extremo a extremo sin errores bloqueantes, respetando permisos, integridad de datos y trazabilidad.
