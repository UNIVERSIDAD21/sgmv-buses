-- P7 keeps legacy rows readable while making every new RF-04 write explicit.
ALTER TABLE ordenes_trabajo
  ADD CONSTRAINT ck_p7_origen_orden_coherente CHECK (
    (origen = 'NOVEDAD' AND tipo = 'CORRECTIVA' AND novedad_id IS NOT NULL
      AND programacion_mantenimiento_id IS NULL)
    OR (origen = 'PREVENTIVO' AND tipo = 'PREVENTIVA' AND novedad_id IS NULL
      AND programacion_mantenimiento_id IS NOT NULL)
    OR (origen = 'CORRECTIVO_DIRECTO' AND tipo = 'CORRECTIVA' AND novedad_id IS NULL
      AND programacion_mantenimiento_id IS NULL)
  ) NOT VALID;

ALTER TABLE consumos_repuesto
  DROP CONSTRAINT ck_obj_consumo_compatibilidad,
  ADD CONSTRAINT ck_obj_consumo_compatibilidad CHECK ((
    (resultado_compatibilidad IS NULL AND regla_compatibilidad_id IS NULL
      AND regla_version IS NULL AND evidencia_compatibilidad IS NULL
      AND autorizado_por_id IS NULL AND fecha_autorizacion IS NULL AND motivo_excepcion IS NULL)
    OR (resultado_compatibilidad = 'NO_EVALUADA_LEGADO' AND
      num_nonnulls(regla_compatibilidad_id, regla_version, evidencia_compatibilidad,
                    autorizado_por_id, fecha_autorizacion, motivo_excepcion) = 0)
    OR (resultado_compatibilidad = 'COMPATIBLE' AND intervencion_id IS NOT NULL
      AND regla_compatibilidad_id IS NOT NULL AND regla_version IS NOT NULL AND regla_version > 0
      AND evidencia_compatibilidad IS NOT NULL AND jsonb_typeof(evidencia_compatibilidad) = 'object'
      AND evidencia_compatibilidad <> '{}'::jsonb
      AND num_nonnulls(autorizado_por_id, fecha_autorizacion, motivo_excepcion) = 0)
    OR (resultado_compatibilidad = 'EXCEPCION_AUTORIZADA' AND intervencion_id IS NOT NULL
      AND evidencia_compatibilidad IS NOT NULL AND jsonb_typeof(evidencia_compatibilidad) = 'object'
      AND evidencia_compatibilidad <> '{}'::jsonb
      AND num_nonnulls(autorizado_por_id, fecha_autorizacion, motivo_excepcion) = 3
      AND length(btrim(motivo_excepcion)) > 0 AND fecha_autorizacion <= fecha_consumo
      AND ((regla_compatibilidad_id IS NULL AND regla_version IS NULL)
        OR (regla_compatibilidad_id IS NOT NULL AND regla_version IS NOT NULL AND regla_version > 0)))
  ) IS TRUE) NOT VALID;

CREATE OR REPLACE FUNCTION sgmv_p7_guardar_consumo_contexto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i intervenciones%ROWTYPE; o ordenes_trabajo%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.resultado_compatibilidad IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.intervencion_id IS NULL THEN
    RAISE EXCEPTION 'El consumo nuevo requiere intervencion activa propia de la misma orden' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT o FROM ordenes_trabajo WHERE id=NEW.orden_trabajo_id FOR SHARE;
  SELECT * INTO STRICT i FROM intervenciones WHERE id=NEW.intervencion_id FOR SHARE;
  IF o.estado <> 'EN_EJECUCION' OR o.tecnico_asignado_id IS DISTINCT FROM NEW.consumido_por_id
    OR i.orden_trabajo_id <> NEW.orden_trabajo_id OR i.tecnico_id <> NEW.consumido_por_id
    OR i.fecha_fin IS NOT NULL THEN
    RAISE EXCEPTION 'El consumo nuevo requiere intervencion activa propia de la misma orden' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_p7_consumo_contexto BEFORE INSERT ON consumos_repuesto
  FOR EACH ROW EXECUTE FUNCTION sgmv_p7_guardar_consumo_contexto();
