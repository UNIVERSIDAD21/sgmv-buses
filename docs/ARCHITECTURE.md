# Arquitectura

## Estado final P14

La topología es `Browser → Vercel → /api rewrite → Render → Neon`. Vercel sirve el
frontend Vite y Render la API Express. Prisma usa conexión pooled en runtime y conexión
directa durante migraciones. La aplicación auditada corresponde a
`3a4b0134e8960c499c3d77317ba138acb5ba3137`.

La autorización se aplica en backend por rol, propiedad y privacidad de campo. El
Administrador conserva economía autorizada; el Mecánico recibe información técnica sin
costos; el Despachador recibe solo proyección operativa. P14 no agregó migraciones.
Operación y recuperación: `docs/p14/INVENTARIO_FINAL.md`.

## Stack

- Frontend: React, Vite y Tailwind CSS.
- Backend: Node.js, Express y API REST.
- Base de datos: PostgreSQL en Neon.
- ORM: Prisma.
- Validacion: Zod.
- Autenticacion: bcrypt y JWT en cookie HttpOnly.

## Vista general

```text
Actores
  -> Aplicacion web React
  -> API REST Express
  -> Servicios de negocio
  -> Repositorios Prisma
  -> PostgreSQL/Neon
```

## Actores objetivo

- Administrador.
- Despachador.
- Mecanico.
- Conductor.

El Sistema aparece solo para calculos, clasificaciones y alertas; no es cuenta de usuario.

## Modulos funcionales

- Autenticacion y autorizacion transversal.
- Flota.
- Jornadas/turnos y despacho basico.
- Rutas basicas como contexto.
- Kilometraje contextual.
- Novedades.
- Mantenimiento preventivo.
- Ordenes de trabajo.
- Intervenciones.
- Repuestos e inventario.
- Compatibilidad tecnica.
- Alertas internas.
- Historial e informes.

## Estado del codigo actual

El backend y frontend existentes ya implementan:

- auth;
- flota;
- novedades;
- preventivos;
- ordenes;
- repuestos;
- historial/informes.

La persistencia ya incluye las tablas y relaciones de jornadas, rutas, alertas, compatibilidad y kilometraje contextual. El backend y frontend reconocen `DESPACHADOR`, pero aun no implementan completamente los servicios, endpoints, autorizacion y pantallas de:

- modulo completo de despacho y jornadas/turnos;
- rutas basicas;
- bandeja y generacion funcional de alertas internas;
- compatibilidad de repuestos;
- kilometraje contextual completo.

## Principios de arquitectura

- Separar presentacion, logica de negocio y persistencia.
- Validar reglas criticas en backend.
- No confiar en IDs del cliente para ampliar alcance.
- Mantener DTOs por rol.
- No exponer costos o diagnosticos a roles no autorizados.
- Usar transacciones para operaciones que cambian disponibilidad, stock o historial.
- Mantener historial derivado desde eventos reales.
- No crear microservicios ni integraciones externas para este prototipo.

## Flujo operativo objetivo

```text
Despachador crea jornada
  -> Sistema valida disponibilidad/superposicion
  -> Conductor inicia jornada y confirma kilometraje
  -> Conductor reporta novedad con kilometraje
  -> Sistema alerta a Despachador/Administrador
  -> Administrador genera orden si aplica
  -> Mecanico ejecuta intervencion y consume repuestos compatibles
  -> Administrador cierra
  -> Sistema actualiza historial, disponibilidad e informes
```

## Alertas

Las alertas internas se implementan como capacidad transversal:

- generadas por reglas de negocio;
- visibles en bandeja interna;
- filtradas por usuario/rol;
- relacionadas con el registro origen;
- sin SMS, WhatsApp, correo automatico ni push externo.

## Rutas

Ruta es dato de apoyo de jornada. No representa modulo de transporte completo.

Permitido:

- codigo;
- nombre;
- origen;
- destino;
- estado.

Excluido:

- GPS;
- mapa en tiempo real;
- paradas;
- frecuencia;
- tarifa;
- recaudo;
- optimizacion.
