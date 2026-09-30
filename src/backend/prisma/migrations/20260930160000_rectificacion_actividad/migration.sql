-- Anulación lógica trazable: el original permanece visible y no cuenta como trabajo válido.
ALTER TABLE "actividades_orden"
  ADD COLUMN "anulada_at" TIMESTAMPTZ,
  ADD COLUMN "anulada_por_id" INTEGER,
  ADD COLUMN "motivo_anulacion" TEXT;

ALTER TABLE "actividades_orden"
  ADD CONSTRAINT "ck_actividad_anulacion_completa"
  CHECK (
    ("anulada_at" IS NULL AND "anulada_por_id" IS NULL AND "motivo_anulacion" IS NULL)
    OR ("anulada_at" IS NOT NULL AND "anulada_por_id" IS NOT NULL
      AND "motivo_anulacion" IS NOT NULL AND length(btrim("motivo_anulacion")) >= 3)
  ),
  ADD CONSTRAINT "actividades_orden_anulada_por_id_fkey"
  FOREIGN KEY ("anulada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "actividades_orden_anulada_por_id_idx" ON "actividades_orden"("anulada_por_id");

CREATE FUNCTION sgmv_actividad_rectificacion_inmutable() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF ROW(NEW.id, NEW.intervencion_id, NEW.descripcion, NEW.fecha_registro, NEW.registrada_por_id)
    IS DISTINCT FROM ROW(OLD.id, OLD.intervencion_id, OLD.descripcion, OLD.fecha_registro, OLD.registrada_por_id)
    OR (OLD.anulada_at IS NOT NULL AND
      ROW(NEW.anulada_at, NEW.anulada_por_id, NEW.motivo_anulacion)
      IS DISTINCT FROM ROW(OLD.anulada_at, OLD.anulada_por_id, OLD.motivo_anulacion)) THEN
    RAISE EXCEPTION 'La actividad original y su rectificación no pueden modificarse' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_actividad_rectificacion_inmutable
BEFORE UPDATE ON "actividades_orden"
FOR EACH ROW EXECUTE FUNCTION sgmv_actividad_rectificacion_inmutable();
