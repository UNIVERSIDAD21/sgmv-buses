ALTER TABLE "novedades"
  ADD COLUMN "motivo_ausencia_lectura" VARCHAR(500),
  ADD COLUMN "reportada_antes_salida" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "novedades"
  ADD CONSTRAINT "novedades_lectura_ausente_coherente" CHECK (
    "motivo_ausencia_lectura" IS NULL OR
    ("lectura_kilometraje_id" IS NULL AND length(btrim("motivo_ausencia_lectura")) >= 10)
  ),
  ADD CONSTRAINT "novedades_antes_salida_con_jornada" CHECK (
    NOT "reportada_antes_salida" OR "jornada_operativa_id" IS NOT NULL
  );

-- Se sustituye solo el trigger de novedades. Los controles existentes de
-- jornadas, lecturas, órdenes e intervenciones conservan su función original.
CREATE FUNCTION sgmv_obj_contexto_novedad_lectura_opcional() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE n novedades%ROWTYPE; j jornadas_operativas%ROWTYPE;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    SELECT * INTO n FROM novedades WHERE id = NEW.id;
    IF FOUND THEN
      IF n.jornada_operativa_id IS NOT NULL OR n.lectura_kilometraje_id IS NOT NULL
         OR n.motivo_ausencia_lectura IS NOT NULL OR n.reportada_antes_salida THEN
        IF n.jornada_operativa_id IS NULL OR n.fecha_ocurrencia IS NULL THEN
          RAISE EXCEPTION 'Contexto de novedad incompleto al confirmar' USING ERRCODE = '23514';
        END IF;
        SELECT * INTO STRICT j FROM jornadas_operativas WHERE id = n.jornada_operativa_id;
        IF n.bus_id <> j.bus_id OR n.conductor_id <> j.conductor_id THEN
          RAISE EXCEPTION 'Novedad no corresponde al bus/conductor de la jornada' USING ERRCODE = '23514';
        END IF;
        IF n.lectura_kilometraje_id IS NULL THEN
          IF n.motivo_ausencia_lectura IS NULL OR length(btrim(n.motivo_ausencia_lectura)) < 10 THEN
            RAISE EXCEPTION 'La ausencia de lectura requiere motivo' USING ERRCODE = '23514';
          END IF;
        ELSE
          IF n.motivo_ausencia_lectura IS NOT NULL THEN
            RAISE EXCEPTION 'Lectura y motivo de ausencia son excluyentes' USING ERRCODE = '23514';
          END IF;
          PERFORM sgmv_obj_assert_lectura(n.lectura_kilometraje_id);
        END IF;
      END IF;
      IF EXISTS (SELECT 1 FROM ordenes_trabajo o WHERE o.novedad_id = n.id
          AND n.jornada_operativa_id IS NOT NULL
          AND o.jornada_operativa_id IS DISTINCT FROM n.jornada_operativa_id) THEN
        RAISE EXCEPTION 'Orden de novedad con jornada diferente' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.lectura_kilometraje_id IS NOT NULL THEN
    PERFORM sgmv_obj_assert_lectura(OLD.lectura_kilometraje_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER tr_obj_contexto_novedad ON novedades;
CREATE CONSTRAINT TRIGGER tr_obj_contexto_novedad
AFTER INSERT OR UPDATE OR DELETE ON novedades
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sgmv_obj_contexto_novedad_lectura_opcional();
