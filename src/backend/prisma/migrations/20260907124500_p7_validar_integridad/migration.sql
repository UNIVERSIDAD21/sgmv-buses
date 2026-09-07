-- P7 deja de tolerar filas heredadas fuera del contrato una vez comprobado el
-- inventario local: toda orden conserva un origen coherente y todo consumo su
-- snapshot de compatibilidad o su contexto tecnico permitido.
ALTER TABLE ordenes_trabajo
  VALIDATE CONSTRAINT ck_p7_origen_orden_coherente;

ALTER TABLE consumos_repuesto
  VALIDATE CONSTRAINT ck_obj_consumo_compatibilidad;
