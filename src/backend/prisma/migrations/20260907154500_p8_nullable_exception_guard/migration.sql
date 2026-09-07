-- Los consumos historicos o no evaluados no deben intentar resolver una
-- autorizacion de excepcion inexistente. IS DISTINCT FROM trata NULL de forma
-- explicita y conserva la validacion estricta solo para EXCEPCION_AUTORIZADA.
CREATE OR REPLACE FUNCTION sgmv_p8_validar_excepcion_consumo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  authorization_row autorizaciones_excepcion_consumo%ROWTYPE;
  role_row roles%ROWTYPE;
BEGIN
  IF NEW.resultado_compatibilidad IS DISTINCT FROM 'EXCEPCION_AUTORIZADA' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO STRICT authorization_row
    FROM autorizaciones_excepcion_consumo
    WHERE id = NEW.autorizacion_excepcion_id FOR UPDATE;
  SELECT role_record.* INTO STRICT role_row
    FROM roles AS role_record
    JOIN usuarios AS user_record ON user_record.rol_id = role_record.id
    WHERE user_record.id = authorization_row.autorizado_por_id;

  IF role_row.codigo <> 'ADMINISTRADOR' OR authorization_row.estado <> 'VIGENTE'
     OR authorization_row.orden_trabajo_id <> NEW.orden_trabajo_id
     OR authorization_row.intervencion_id <> NEW.intervencion_id
     OR authorization_row.repuesto_id <> NEW.repuesto_id
     OR authorization_row.autorizado_por_id IS DISTINCT FROM NEW.autorizado_por_id
     OR NEW.cantidad > authorization_row.cantidad_maxima
     OR authorization_row.fecha_autorizacion > NEW.fecha_consumo
     OR (authorization_row.fecha_expiracion IS NOT NULL
       AND authorization_row.fecha_expiracion <= NEW.fecha_consumo) THEN
    RAISE EXCEPTION 'La autorizacion de excepcion no corresponde al consumo' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END;
$$;

-- La base de datos tambien materializa el uso unico. De este modo una
-- escritura directa coherente no puede dejar un consumo confirmado junto a
-- una autorizacion que siga aparentando estar vigente.
CREATE OR REPLACE FUNCTION sgmv_p8_marcar_excepcion_usada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.resultado_compatibilidad IS DISTINCT FROM 'EXCEPCION_AUTORIZADA' THEN
    RETURN NEW;
  END IF;

  UPDATE autorizaciones_excepcion_consumo
  SET estado = 'USADA', updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.autorizacion_excepcion_id AND estado = 'VIGENTE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La autorizacion de excepcion no esta vigente' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_p8_marcar_excepcion_usada ON consumos_repuesto;
CREATE TRIGGER tr_p8_marcar_excepcion_usada
  AFTER INSERT ON consumos_repuesto
  FOR EACH ROW EXECUTE FUNCTION sgmv_p8_marcar_excepcion_usada();
