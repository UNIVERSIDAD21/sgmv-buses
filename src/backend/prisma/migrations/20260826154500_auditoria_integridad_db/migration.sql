-- Final audit hardening for the persistence structure.
-- This migration is corrective, additive, and non-destructive. It does not
-- modify the initial migration that was already applied.

-- Normalize existing development/demo data before adding stricter checks.
UPDATE "usuarios"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

UPDATE "buses"
SET
  "codigo_interno" = upper(btrim("codigo_interno")),
  "placa" = upper(btrim("placa"))
WHERE
  "codigo_interno" <> upper(btrim("codigo_interno"))
  OR "placa" <> upper(btrim("placa"));

UPDATE "ordenes_trabajo"
SET "codigo" = upper(btrim("codigo"))
WHERE "codigo" <> upper(btrim("codigo"));

UPDATE "repuestos"
SET "codigo" = upper(btrim("codigo"))
WHERE "codigo" <> upper(btrim("codigo"));

UPDATE "ordenes_trabajo"
SET "fecha_asignacion" = COALESCE("fecha_asignacion", "fecha_creacion")
WHERE "estado" <> 'PENDIENTE_ASIGNACION'
  AND "fecha_asignacion" IS NULL;

UPDATE "ordenes_trabajo"
SET "fecha_creacion" = "fecha_asignacion"
WHERE "fecha_asignacion" IS NOT NULL
  AND "fecha_asignacion" < "fecha_creacion";

UPDATE "ordenes_trabajo"
SET "fecha_asignacion" = "fecha_inicio_ejecucion"
WHERE "fecha_inicio_ejecucion" IS NOT NULL
  AND (
    "fecha_asignacion" IS NULL
    OR "fecha_inicio_ejecucion" < "fecha_asignacion"
  );

UPDATE "ordenes_trabajo"
SET "fecha_inicio_ejecucion" = "fecha_completada_tecnico"
WHERE "fecha_completada_tecnico" IS NOT NULL
  AND (
    "fecha_inicio_ejecucion" IS NULL
    OR "fecha_completada_tecnico" < "fecha_inicio_ejecucion"
  );

UPDATE "ordenes_trabajo"
SET "fecha_completada_tecnico" = "fecha_cierre"
WHERE "fecha_cierre" IS NOT NULL
  AND (
    "fecha_completada_tecnico" IS NULL
    OR "fecha_cierre" < "fecha_completada_tecnico"
  );

UPDATE "ordenes_trabajo" AS "ot"
SET "costo_total" = COALESCE(
  (
    SELECT sum("cr"."subtotal")
    FROM "consumos_repuesto" AS "cr"
    WHERE "cr"."orden_trabajo_id" = "ot"."id"
  ),
  0
);

-- Composite keys used by cross-table integrity constraints.
ALTER TABLE "novedades"
ADD CONSTRAINT "novedades_id_bus_id_key" UNIQUE ("id", "bus_id");

ALTER TABLE "programaciones_mantenimiento"
ADD CONSTRAINT "programaciones_mantenimiento_id_bus_id_key" UNIQUE ("id", "bus_id");

ALTER TABLE "consumos_repuesto"
ADD CONSTRAINT "consumos_repuesto_id_repuesto_id_key" UNIQUE ("id", "repuesto_id");

-- Case-insensitive uniqueness and canonical storage for identifiers.
CREATE UNIQUE INDEX "ux_usuarios_email_lower"
ON "usuarios" (lower("email"));

CREATE UNIQUE INDEX "ux_buses_codigo_interno_upper"
ON "buses" (upper("codigo_interno"));

CREATE UNIQUE INDEX "ux_buses_placa_upper"
ON "buses" (upper("placa"));

CREATE UNIQUE INDEX "ux_ordenes_trabajo_codigo_upper"
ON "ordenes_trabajo" (upper("codigo"));

CREATE UNIQUE INDEX "ux_repuestos_codigo_upper"
ON "repuestos" (upper("codigo"));

ALTER TABLE "usuarios"
ADD CONSTRAINT "ck_usuarios_email_normalizado"
CHECK (
  "email" = lower(btrim("email"))
  AND "email" <> ''
);

ALTER TABLE "buses"
ADD CONSTRAINT "ck_buses_identificadores_normalizados"
CHECK (
  "codigo_interno" = upper(btrim("codigo_interno"))
  AND "codigo_interno" <> ''
  AND "placa" = upper(btrim("placa"))
  AND "placa" <> ''
);

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ck_ordenes_codigo_normalizado"
CHECK (
  "codigo" = upper(btrim("codigo"))
  AND "codigo" <> ''
);

ALTER TABLE "repuestos"
ADD CONSTRAINT "ck_repuestos_codigo_normalizado"
CHECK (
  "codigo" = upper(btrim("codigo"))
  AND "codigo" <> ''
);

-- Cross-table bus coherence for orders created from novelty or preventive schedule.
ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ordenes_trabajo_novedad_bus_id_fkey"
FOREIGN KEY ("novedad_id", "bus_id")
REFERENCES "novedades"("id", "bus_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ordenes_trabajo_programacion_bus_id_fkey"
FOREIGN KEY ("programacion_mantenimiento_id", "bus_id")
REFERENCES "programaciones_mantenimiento"("id", "bus_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Cross-table spare-part coherence for consumption movements.
ALTER TABLE "movimientos_inventario"
ADD CONSTRAINT "movimientos_inventario_consumo_repuesto_id_repuesto_id_fkey"
FOREIGN KEY ("consumo_repuesto_id", "repuesto_id")
REFERENCES "consumos_repuesto"("id", "repuesto_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Chronological work-order dates and assignment date requirements.
ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ck_ordenes_fechas_cronologicas"
CHECK (
  (
    "fecha_asignacion" IS NULL
    OR "fecha_asignacion" >= "fecha_creacion"
  )
  AND (
    "fecha_inicio_ejecucion" IS NULL
    OR (
      "fecha_asignacion" IS NOT NULL
      AND "fecha_inicio_ejecucion" >= "fecha_asignacion"
    )
  )
  AND (
    "fecha_completada_tecnico" IS NULL
    OR (
      "fecha_inicio_ejecucion" IS NOT NULL
      AND "fecha_completada_tecnico" >= "fecha_inicio_ejecucion"
    )
  )
  AND (
    "fecha_cierre" IS NULL
    OR (
      "fecha_completada_tecnico" IS NOT NULL
      AND "fecha_cierre" >= "fecha_completada_tecnico"
    )
  )
  AND (
    "estado" = 'PENDIENTE_ASIGNACION'
    OR "fecha_asignacion" IS NOT NULL
  )
  AND (
    "estado" NOT IN ('EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION', 'CERRADA')
    OR "fecha_inicio_ejecucion" IS NOT NULL
  )
  AND (
    "estado" NOT IN ('COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION', 'CERRADA')
    OR "fecha_completada_tecnico" IS NOT NULL
  )
);

-- A closed order is terminal: persistence must reject reopening by status change.
CREATE OR REPLACE FUNCTION "fn_assert_orden_cerrada_terminal"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."estado" = 'CERRADA' AND NEW."estado" <> 'CERRADA' THEN
    RAISE EXCEPTION 'La orden de trabajo cerrada % no puede cambiar de estado', OLD."id";
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_ordenes_trabajo_cerrada_terminal"
BEFORE UPDATE ON "ordenes_trabajo"
FOR EACH ROW
EXECUTE FUNCTION "fn_assert_orden_cerrada_terminal"();

-- Administrative inventory movements must explain their reason.
ALTER TABLE "movimientos_inventario"
ADD CONSTRAINT "ck_movimientos_inventario_motivo_administrativo"
CHECK (
  "tipo" NOT IN ('ENTRADA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA')
  OR (
    "motivo" IS NOT NULL
    AND btrim("motivo") <> ''
  )
);

-- Consumption subtotal is calculated from quantity and historical unit cost.
ALTER TABLE "consumos_repuesto"
ADD CONSTRAINT "ck_consumos_repuesto_subtotal_calculado"
CHECK ("subtotal" = round("cantidad" * "costo_unitario", 2));

-- Keep order total cost derived from real consumption records.
CREATE OR REPLACE FUNCTION "fn_set_orden_costo_total_calculado"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT COALESCE(sum("subtotal"), 0)
  INTO NEW."costo_total"
  FROM "consumos_repuesto"
  WHERE "orden_trabajo_id" = NEW."id";

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_ordenes_trabajo_set_costo_total"
BEFORE INSERT OR UPDATE ON "ordenes_trabajo"
FOR EACH ROW
EXECUTE FUNCTION "fn_set_orden_costo_total_calculado"();

CREATE OR REPLACE FUNCTION "fn_recalcular_costo_total_orden"("p_orden_trabajo_id" UUID)
RETURNS void
LANGUAGE plpgsql
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

CREATE TRIGGER "trg_consumos_repuesto_recalcular_costo_total"
AFTER INSERT OR UPDATE OR DELETE ON "consumos_repuesto"
FOR EACH ROW
EXECUTE FUNCTION "fn_trg_recalcular_costo_total_orden"();

-- Every ConsumoRepuesto must have exactly one CONSUMO inventory movement.
-- The constraint is deferrable so service transactions can insert consumption
-- and movement in any order before commit.
CREATE OR REPLACE FUNCTION "fn_assert_consumo_repuesto_movimiento_unico"()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE CONSTRAINT TRIGGER "trg_consumos_repuesto_movimiento_unico"
AFTER INSERT OR UPDATE ON "consumos_repuesto"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "fn_assert_consumo_repuesto_movimiento_unico"();

CREATE CONSTRAINT TRIGGER "trg_movimientos_inventario_consumo_unico"
AFTER INSERT OR UPDATE OR DELETE ON "movimientos_inventario"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "fn_assert_consumo_repuesto_movimiento_unico"();
