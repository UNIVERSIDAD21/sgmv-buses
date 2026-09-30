ALTER TABLE "jornadas_operativas" DROP CONSTRAINT "ck_obj_jornada_conciliacion";
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "ck_obj_jornada_conciliacion" CHECK (
  (estado <> 'INTERRUMPIDA' AND estado_conciliacion_lectura IS NULL
    AND motivo_ausencia_lectura IS NULL AND conciliada_por_id IS NULL
    AND conciliada_at IS NULL AND motivo_no_recuperable IS NULL)
  OR (estado = 'INTERRUMPIDA' AND (
    (estado_conciliacion_lectura = 'PENDIENTE'
      AND COALESCE(length(btrim(motivo_ausencia_lectura)), 0) >= 3
      AND conciliada_por_id IS NULL AND conciliada_at IS NULL AND motivo_no_recuperable IS NULL)
    OR (estado_conciliacion_lectura = 'LECTURA_FINAL_REGISTRADA'
      AND (motivo_ausencia_lectura IS NULL OR length(btrim(motivo_ausencia_lectura)) >= 3)
      AND conciliada_por_id IS NOT NULL AND conciliada_at IS NOT NULL AND motivo_no_recuperable IS NULL)
    OR (estado_conciliacion_lectura = 'NO_RECUPERABLE'
      AND COALESCE(length(btrim(motivo_ausencia_lectura)), 0) >= 3
      AND conciliada_por_id IS NOT NULL AND conciliada_at IS NOT NULL
      AND COALESCE(length(btrim(motivo_no_recuperable)), 0) >= 3)
  ))
);

DO $migration$
DECLARE
  guard_sql text := pg_get_functiondef('sgmv_obj_guardar_jornada'::regproc);
BEGIN
  IF guard_sql IS NULL OR position('  RETURN NEW;' in guard_sql) = 0 THEN
    RAISE EXCEPTION 'El guard SQL de jornadas no coincide con la versión esperada';
  END IF;
  guard_sql := replace(guard_sql, '  RETURN NEW;', $guard$
  IF TG_OP='UPDATE' AND OLD.estado='INTERRUMPIDA' AND (
    ROW(NEW.cambio_por_id, NEW.fecha_cambio, NEW.motivo_cambio, NEW.motivo_ausencia_lectura)
    IS DISTINCT FROM
    ROW(OLD.cambio_por_id, OLD.fecha_cambio, OLD.motivo_cambio, OLD.motivo_ausencia_lectura)
  ) THEN
    RAISE EXCEPTION 'La interrupcion y su motivo original son inmutables' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.estado='INTERRUMPIDA' AND
    OLD.estado_conciliacion_lectura IN ('LECTURA_FINAL_REGISTRADA', 'NO_RECUPERABLE') AND
    ROW(NEW.conciliada_por_id, NEW.conciliada_at, NEW.motivo_no_recuperable, NEW.detalle_conciliacion)
    IS DISTINCT FROM
    ROW(OLD.conciliada_por_id, OLD.conciliada_at, OLD.motivo_no_recuperable, OLD.detalle_conciliacion) THEN
    RAISE EXCEPTION 'La conciliacion terminal es inmutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;$guard$);
  EXECUTE guard_sql;
END;
$migration$;
