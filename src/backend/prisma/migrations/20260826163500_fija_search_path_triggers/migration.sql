-- Make trigger functions schema-safe for disposable Neon schema validation.
-- The previous migration created the right triggers, but PL/pgSQL functions
-- used unqualified table names. Fixing search_path at function level prevents
-- plan-cache/schema bleed when the same migrations are validated outside public.

CREATE OR REPLACE FUNCTION "fn_set_orden_costo_total_calculado"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  SELECT COALESCE(sum("subtotal"), 0)
  INTO NEW."costo_total"
  FROM "consumos_repuesto"
  WHERE "orden_trabajo_id" = NEW."id";

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "fn_recalcular_costo_total_orden"("p_orden_trabajo_id" UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  UPDATE "ordenes_trabajo"
  SET "costo_total" = COALESCE(
    (
      SELECT sum("subtotal")
      FROM "consumos_repuesto"
      WHERE "orden_trabajo_id" = "p_orden_trabajo_id"
    ),
    0
  )
  WHERE "id" = "p_orden_trabajo_id";
END;
$$;

CREATE OR REPLACE FUNCTION "fn_trg_recalcular_costo_total_orden"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "fn_recalcular_costo_total_orden"(OLD."orden_trabajo_id");
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."orden_trabajo_id" IS DISTINCT FROM NEW."orden_trabajo_id" THEN
    PERFORM "fn_recalcular_costo_total_orden"(OLD."orden_trabajo_id");
  END IF;

  PERFORM "fn_recalcular_costo_total_orden"(NEW."orden_trabajo_id");
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "fn_assert_consumo_repuesto_movimiento_unico"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  "v_consumo_ids" UUID[];
  "v_consumo_id" UUID;
  "v_movimientos" INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'consumos_repuesto' THEN
    IF TG_OP = 'DELETE' THEN
      "v_consumo_ids" := ARRAY[OLD."id"]::UUID[];
    ELSE
      "v_consumo_ids" := ARRAY[NEW."id"]::UUID[];
    END IF;
  ELSE
    "v_consumo_ids" := ARRAY_REMOVE(
      ARRAY[
        CASE WHEN TG_OP <> 'INSERT' THEN OLD."consumo_repuesto_id" END,
        CASE WHEN TG_OP <> 'DELETE' THEN NEW."consumo_repuesto_id" END
      ]::UUID[],
      NULL
    );
  END IF;

  FOREACH "v_consumo_id" IN ARRAY "v_consumo_ids" LOOP
    IF EXISTS (
      SELECT 1
      FROM "consumos_repuesto"
      WHERE "id" = "v_consumo_id"
    ) THEN
      SELECT count(*)::INTEGER
      INTO "v_movimientos"
      FROM "movimientos_inventario"
      WHERE "consumo_repuesto_id" = "v_consumo_id"
        AND "tipo" = 'CONSUMO';

      IF "v_movimientos" <> 1 THEN
        RAISE EXCEPTION 'ConsumoRepuesto % debe tener exactamente un MovimientoInventario tipo CONSUMO, tiene %',
          "v_consumo_id",
          "v_movimientos";
      END IF;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "fn_assert_orden_cerrada_terminal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  IF OLD."estado" = 'CERRADA' AND NEW."estado" <> 'CERRADA' THEN
    RAISE EXCEPTION 'La orden de trabajo cerrada % no puede cambiar de estado', OLD."id";
  END IF;

  RETURN NEW;
END;
$$;
