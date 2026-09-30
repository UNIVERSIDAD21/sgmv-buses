ALTER TABLE "jornadas_operativas"
  ADD COLUMN "detalle_conciliacion" TEXT;

ALTER TABLE "jornadas_operativas"
  ADD CONSTRAINT "ck_obj_jornada_detalle_conciliacion" CHECK (
    (estado_conciliacion_lectura IS NULL OR estado_conciliacion_lectura = 'PENDIENTE')
      AND detalle_conciliacion IS NULL
    OR estado_conciliacion_lectura IN ('LECTURA_FINAL_REGISTRADA', 'NO_RECUPERABLE')
      AND (detalle_conciliacion IS NULL OR length(btrim(detalle_conciliacion)) >= 10)
  );
