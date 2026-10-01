-- El costo de la orden es consumo original menos reversos compensatorios.
-- La función anterior se reemplaza sin alterar las migraciones aplicadas.
CREATE OR REPLACE FUNCTION "fn_set_orden_costo_total_calculado"()
RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  SELECT COALESCE((
    SELECT sum(c."subtotal") FROM "consumos_repuesto" c
    WHERE c."orden_trabajo_id" = NEW."id"
  ), 0) - COALESCE((
    SELECT sum(r."subtotal") FROM "reversos_consumo" r
    JOIN "consumos_repuesto" c ON c."id" = r."consumo_original_id"
    WHERE c."orden_trabajo_id" = NEW."id"
  ), 0) INTO NEW."costo_total";
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "fn_recalcular_costo_total_orden"("p_orden_trabajo_id" integer)
RETURNS void LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  UPDATE "ordenes_trabajo" SET "costo_total" = COALESCE((
    SELECT sum(c."subtotal") FROM "consumos_repuesto" c
    WHERE c."orden_trabajo_id" = "p_orden_trabajo_id"
  ), 0) - COALESCE((
    SELECT sum(r."subtotal") FROM "reversos_consumo" r
    JOIN "consumos_repuesto" c ON c."id" = r."consumo_original_id"
    WHERE c."orden_trabajo_id" = "p_orden_trabajo_id"
  ), 0)
  WHERE "id" = "p_orden_trabajo_id";
END;
$$;

CREATE FUNCTION "fn_trg_recalcular_costo_total_reverso"()
RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE orden_id integer;
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    SELECT "orden_trabajo_id" INTO orden_id FROM "consumos_repuesto"
    WHERE "id" = OLD."consumo_original_id";
    IF orden_id IS NOT NULL THEN
      PERFORM "fn_recalcular_costo_total_orden"(orden_id);
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "orden_trabajo_id" INTO orden_id FROM "consumos_repuesto"
    WHERE "id" = NEW."consumo_original_id";
    IF orden_id IS NOT NULL THEN
      PERFORM "fn_recalcular_costo_total_orden"(orden_id);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_reversos_consumo_recalcular_costo_total"
AFTER INSERT OR UPDATE OR DELETE ON "reversos_consumo"
FOR EACH ROW EXECUTE FUNCTION "fn_trg_recalcular_costo_total_reverso"();
