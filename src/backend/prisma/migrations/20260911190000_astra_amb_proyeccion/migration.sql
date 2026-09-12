ALTER TABLE rutas
 ADD COLUMN longitud_km_oficial decimal(10,3),
 ADD COLUMN semantica_longitud_oficial varchar(40) NOT NULL DEFAULT 'NO_DETERMINADA',
 ADD COLUMN semantica_longitud_demo varchar(40) NOT NULL DEFAULT 'CIRCUITO_COMPLETO',
 ADD COLUMN origen_semantica_demo varchar(40) NOT NULL DEFAULT 'SIMULADO_SGMV',
 ADD COLUMN origen_dato varchar(40) NOT NULL DEFAULT 'SIMULADO_SGMV',
 ADD COLUMN operador varchar(160),
 ADD COLUMN procedencia jsonb NOT NULL DEFAULT '{}',
 ADD CONSTRAINT ck_ruta_amb_procedencia CHECK (
   (longitud_km_oficial IS NULL OR longitud_km_oficial>0)
   AND origen_dato IN ('OFICIAL','SIMULADO_SGMV')
   AND semantica_longitud_oficial='NO_DETERMINADA'
   AND semantica_longitud_demo='CIRCUITO_COMPLETO'
   AND origen_semantica_demo='SIMULADO_SGMV'
   AND (origen_dato<>'OFICIAL' OR (longitud_km_oficial IS NOT NULL AND operador IS NOT NULL))
 );
ALTER TABLE jornadas_operativas
 ADD COLUMN ciclos_completos_simulados integer,
 ADD COLUMN km_no_comerciales_simulados decimal(10,3),
 ADD COLUMN longitud_km_oficial_snapshot decimal(10,3),
 ADD COLUMN km_proyectados_demo decimal(12,3),
 ADD CONSTRAINT ck_jornada_proyeccion_simulada CHECK (
   (ciclos_completos_simulados IS NULL AND km_no_comerciales_simulados IS NULL
    AND longitud_km_oficial_snapshot IS NULL AND km_proyectados_demo IS NULL)
   OR (ciclos_completos_simulados IS NOT NULL AND km_no_comerciales_simulados IS NOT NULL
    AND longitud_km_oficial_snapshot IS NOT NULL AND km_proyectados_demo IS NOT NULL
    AND ruta_id IS NOT NULL AND ciclos_completos_simulados BETWEEN 1 AND 100
    AND km_no_comerciales_simulados BETWEEN 0 AND 1000 AND longitud_km_oficial_snapshot>0
    AND km_proyectados_demo=longitud_km_oficial_snapshot*ciclos_completos_simulados+km_no_comerciales_simulados)
 );
CREATE FUNCTION sgmv_amb_proteger_ruta_oficial() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.origen_dato='OFICIAL' AND
  ROW(NEW.codigo,NEW.nombre,NEW.origen,NEW.destino,NEW.longitud_km_oficial,NEW.operador,NEW.origen_dato,NEW.procedencia)
  IS DISTINCT FROM
  ROW(OLD.codigo,OLD.nombre,OLD.origen,OLD.destino,OLD.longitud_km_oficial,OLD.operador,OLD.origen_dato,OLD.procedencia)
 THEN RAISE EXCEPTION 'OFFICIAL_ROUTE_IMMUTABLE: actualizar fuente mediante migracion revisada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tr_ruta_amb_oficial BEFORE UPDATE ON rutas FOR EACH ROW EXECUTE FUNCTION sgmv_amb_proteger_ruta_oficial();
