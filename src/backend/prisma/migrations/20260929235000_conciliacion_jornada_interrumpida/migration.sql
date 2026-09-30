CREATE TYPE "estado_conciliacion_lectura" AS ENUM ('PENDIENTE', 'LECTURA_FINAL_REGISTRADA', 'NO_RECUPERABLE');

ALTER TABLE "jornadas_operativas"
  ADD COLUMN "estado_conciliacion_lectura" "estado_conciliacion_lectura",
  ADD COLUMN "motivo_ausencia_lectura" TEXT,
  ADD COLUMN "conciliada_por_id" INTEGER,
  ADD COLUMN "conciliada_at" TIMESTAMPTZ(6),
  ADD COLUMN "motivo_no_recuperable" TEXT;

ALTER TABLE "jornadas_operativas"
  ADD CONSTRAINT "jornadas_operativas_conciliada_por_id_fkey"
  FOREIGN KEY ("conciliada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "jornadas_operativas_estado_estado_conciliacion_lectura_idx"
  ON "jornadas_operativas"("estado", "estado_conciliacion_lectura");

ALTER TABLE "jornadas_operativas"
  DROP CONSTRAINT "ck_obj_jornada_estados",
  DROP CONSTRAINT "ck_obj_jornada_cambio";

ALTER TABLE "jornadas_operativas"
  ADD CONSTRAINT "ck_obj_jornada_estados" CHECK (
    (estado = 'PROGRAMADA' AND inicio_real IS NULL AND fin_real IS NULL)
    OR (estado = 'EN_CURSO' AND inicio_real IS NOT NULL AND fin_real IS NULL)
    OR (estado IN ('FINALIZADA', 'INTERRUMPIDA') AND inicio_real IS NOT NULL AND fin_real IS NOT NULL)
    OR (estado IN ('CANCELADA', 'REASIGNADA') AND
      ((inicio_real IS NULL AND fin_real IS NULL) OR (inicio_real IS NOT NULL AND fin_real IS NOT NULL)))
  ),
  ADD CONSTRAINT "ck_obj_jornada_cambio" CHECK (
    (num_nonnulls(cambio_por_id, fecha_cambio, motivo_cambio) = 0
      AND estado NOT IN ('CANCELADA', 'REASIGNADA', 'INTERRUMPIDA'))
    OR (num_nonnulls(cambio_por_id, fecha_cambio, motivo_cambio) = 3 AND length(btrim(motivo_cambio)) > 0)
  ),
  ADD CONSTRAINT "ck_obj_jornada_conciliacion" CHECK (
    (estado <> 'INTERRUMPIDA' AND estado_conciliacion_lectura IS NULL
      AND motivo_ausencia_lectura IS NULL AND conciliada_por_id IS NULL
      AND conciliada_at IS NULL AND motivo_no_recuperable IS NULL)
    OR (estado = 'INTERRUMPIDA' AND (
      (estado_conciliacion_lectura = 'PENDIENTE'
        AND COALESCE(length(btrim(motivo_ausencia_lectura)), 0) >= 3
        AND conciliada_por_id IS NULL AND conciliada_at IS NULL AND motivo_no_recuperable IS NULL)
      OR (estado_conciliacion_lectura = 'LECTURA_FINAL_REGISTRADA'
        AND motivo_ausencia_lectura IS NULL AND conciliada_por_id IS NOT NULL
        AND conciliada_at IS NOT NULL AND motivo_no_recuperable IS NULL)
      OR (estado_conciliacion_lectura = 'NO_RECUPERABLE'
        AND COALESCE(length(btrim(motivo_ausencia_lectura)), 0) >= 3
        AND conciliada_por_id IS NOT NULL AND conciliada_at IS NOT NULL
        AND COALESCE(length(btrim(motivo_no_recuperable)), 0) >= 3)
    ))
  );

-- Conservar íntegra la lógica vigente de estos guards y modificar únicamente
-- las ramas de INTERRUMPIDA. La migración falla si la base no tiene el contrato esperado.
DO $migration$
DECLARE
  guard_sql text := pg_get_functiondef('sgmv_obj_guardar_jornada'::regproc);
  assert_sql text := pg_get_functiondef('sgmv_obj_assert_jornada'::regproc);
BEGIN
  IF guard_sql IS NULL OR assert_sql IS NULL
    OR position('OLD.estado=''EN_CURSO'' AND NEW.estado IN (''FINALIZADA'', ''CANCELADA'', ''REASIGNADA'')' in guard_sql) = 0
    OR position('v_anterior.estado <> ''REASIGNADA''' in guard_sql) = 0
    OR position('  RETURN NEW;' in guard_sql) = 0
    OR position('IF j.fin_real IS NOT NULL THEN' in assert_sql) = 0
    OR position('IF j.estado=''REASIGNADA''' in assert_sql) = 0 THEN
    RAISE EXCEPTION 'El contrato SQL de jornadas no coincide con la base esperada';
  END IF;

  guard_sql := replace(guard_sql,
    'OLD.estado=''EN_CURSO'' AND NEW.estado IN (''FINALIZADA'', ''CANCELADA'', ''REASIGNADA'')',
    'OLD.estado=''EN_CURSO'' AND NEW.estado IN (''FINALIZADA'', ''CANCELADA'', ''REASIGNADA'', ''INTERRUMPIDA'')');
  guard_sql := replace(guard_sql,
    'v_anterior.estado <> ''REASIGNADA''',
    'v_anterior.estado NOT IN (''REASIGNADA'', ''INTERRUMPIDA'')');
  guard_sql := replace(guard_sql, '  RETURN NEW;', $guard$
  IF TG_OP='UPDATE' AND OLD.estado='INTERRUMPIDA' AND
    OLD.estado_conciliacion_lectura IN ('LECTURA_FINAL_REGISTRADA', 'NO_RECUPERABLE') AND
    NEW.estado_conciliacion_lectura IS DISTINCT FROM OLD.estado_conciliacion_lectura THEN
    RAISE EXCEPTION 'La conciliacion terminal de la lectura no se revierte' USING ERRCODE='23514';
  END IF;
  IF NEW.estado='INTERRUMPIDA' AND NEW.estado_conciliacion_lectura='NO_RECUPERABLE' AND
    (TG_OP='INSERT' OR NEW.estado_conciliacion_lectura IS DISTINCT FROM OLD.estado_conciliacion_lectura) THEN
    PERFORM sgmv_obj_exigir_rol(NEW.conciliada_por_id, ARRAY['ADMINISTRADOR']);
  END IF;
  RETURN NEW;$guard$);
  EXECUTE guard_sql;

  assert_sql := replace(assert_sql,
    'IF j.fin_real IS NOT NULL THEN',
    'IF j.fin_real IS NOT NULL AND (j.estado <> ''INTERRUMPIDA'' OR j.estado_conciliacion_lectura = ''LECTURA_FINAL_REGISTRADA'') THEN');
  assert_sql := replace(assert_sql, 'IF j.estado=''REASIGNADA''', $assert$
  IF j.estado='INTERRUMPIDA' AND j.estado_conciliacion_lectura IN ('PENDIENTE', 'NO_RECUPERABLE') AND
    EXISTS (SELECT 1 FROM lecturas_kilometraje WHERE jornada_operativa_id=j.id AND tipo='FIN_JORNADA') THEN
    RAISE EXCEPTION 'La interrupcion sin conciliacion no admite lectura final inventada' USING ERRCODE='23514';
  END IF;
  IF j.estado='REASIGNADA'$assert$);
  EXECUTE assert_sql;
END;
$migration$;
