-- La procedencia pertenece a la versión del plan: corregirla exige una nueva versión.
ALTER TABLE "planes_mantenimiento_preventivo"
  ADD CONSTRAINT "ck_plan_sin_referencia"
  CHECK ("origen_regla" <> 'SIN_REFERENCIA' OR "referencia_regla" IS NULL);

CREATE OR REPLACE FUNCTION sgmv_obj_guardar_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM sgmv_obj_exigir_rol(NEW.creado_por_id, ARRAY['ADMINISTRADOR']);
  ELSIF ROW(NEW.id, NEW.clave_tarea, NEW.bus_id, NEW.modelo_bus_id, NEW.creado_por_id,
      NEW.created_at, NEW.version, NEW.componente, NEW.actividad, NEW.criterio,
      NEW.intervalo_dias, NEW.intervalo_km, NEW.anticipacion_dias, NEW.anticipacion_km,
      NEW.prioridad, NEW.bloquea_al_vencer, NEW.origen_regla, NEW.referencia_regla)
    IS DISTINCT FROM ROW(OLD.id, OLD.clave_tarea, OLD.bus_id, OLD.modelo_bus_id, OLD.creado_por_id,
      OLD.created_at, OLD.version, OLD.componente, OLD.actividad, OLD.criterio,
      OLD.intervalo_dias, OLD.intervalo_km, OLD.anticipacion_dias, OLD.anticipacion_km,
      OLD.prioridad, OLD.bloquea_al_vencer, OLD.origen_regla, OLD.referencia_regla) THEN
    RAISE EXCEPTION 'Conservar el plan aplicado: desactivar y crear una nueva version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
