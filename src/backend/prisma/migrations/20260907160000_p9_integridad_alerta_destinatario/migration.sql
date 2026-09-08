-- P9: amplía el catálogo cerrado de alertas internas.
-- La coherencia estado/fechas de cada destinatario ya está protegida por
-- ck_obj_alerta_destinatario_fechas desde la migración base de trazabilidad.
ALTER TYPE "tipo_alerta" ADD VALUE IF NOT EXISTS 'ORDEN_ASIGNADA';
ALTER TYPE "tipo_alerta" ADD VALUE IF NOT EXISTS 'ORDEN_COMPLETADA_TECNICO';
ALTER TYPE "tipo_alerta" ADD VALUE IF NOT EXISTS 'CAMBIO_ESTADO_NOVEDAD';
