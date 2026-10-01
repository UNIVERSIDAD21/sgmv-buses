ALTER TABLE "ordenes_trabajo"
  ADD COLUMN "fecha_anulacion" timestamptz(6),
  ADD COLUMN "anulada_por_id" integer,
  ADD COLUMN "motivo_anulacion" text;

ALTER TABLE "ordenes_trabajo"
  ADD CONSTRAINT "ordenes_trabajo_anulada_por_id_fkey"
  FOREIGN KEY ("anulada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ordenes_trabajo_anulada_por_id_idx" ON "ordenes_trabajo"("anulada_por_id");

ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT "ck_ordenes_tecnico_segun_estado";
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ck_ordenes_tecnico_segun_estado" CHECK (
  ("estado" = 'PENDIENTE_ASIGNACION' AND "tecnico_asignado_id" IS NULL)
  OR "estado" = 'ANULADA'
  OR ("estado" NOT IN ('PENDIENTE_ASIGNACION', 'ANULADA') AND "tecnico_asignado_id" IS NOT NULL)
);

ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT "ck_ordenes_fechas_cronologicas";
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ck_ordenes_fechas_cronologicas" CHECK (
  ("fecha_asignacion" IS NULL OR "fecha_asignacion" >= "fecha_creacion")
  AND ("fecha_inicio_ejecucion" IS NULL OR ("fecha_asignacion" IS NOT NULL AND "fecha_inicio_ejecucion" >= "fecha_asignacion"))
  AND ("fecha_completada_tecnico" IS NULL OR ("fecha_inicio_ejecucion" IS NOT NULL AND "fecha_completada_tecnico" >= "fecha_inicio_ejecucion"))
  AND ("fecha_cierre" IS NULL OR ("fecha_completada_tecnico" IS NOT NULL AND "fecha_cierre" >= "fecha_completada_tecnico"))
  AND ("estado" IN ('PENDIENTE_ASIGNACION', 'ANULADA') OR "fecha_asignacion" IS NOT NULL)
  AND ("estado" NOT IN ('EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION', 'CERRADA') OR "fecha_inicio_ejecucion" IS NOT NULL)
  AND ("estado" NOT IN ('COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION', 'CERRADA') OR "fecha_completada_tecnico" IS NOT NULL)
);

ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ck_orden_anulacion_completa" CHECK (
  ("estado" = 'ANULADA'
    AND "fecha_anulacion" IS NOT NULL
    AND "anulada_por_id" IS NOT NULL
    AND "motivo_anulacion" IS NOT NULL
    AND btrim("motivo_anulacion") <> ''
    AND "fecha_inicio_ejecucion" IS NULL
    AND "espera_tipo" IS NULL)
  OR ("estado" <> 'ANULADA'
    AND "fecha_anulacion" IS NULL
    AND "anulada_por_id" IS NULL
    AND "motivo_anulacion" IS NULL)
);

DROP INDEX "ordenes_trabajo_novedad_id_key";
CREATE UNIQUE INDEX "ux_orden_activa_novedad"
  ON "ordenes_trabajo"("novedad_id")
  WHERE "novedad_id" IS NOT NULL AND "estado" <> 'ANULADA';

DROP INDEX "ux_orden_preventiva_activa_programacion";
CREATE UNIQUE INDEX "ux_orden_preventiva_activa_programacion"
  ON "ordenes_trabajo"("programacion_mantenimiento_id")
  WHERE "programacion_mantenimiento_id" IS NOT NULL
    AND "estado" NOT IN ('CERRADA', 'ANULADA');

CREATE OR REPLACE FUNCTION "fn_assert_orden_cerrada_terminal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD."estado" IN ('CERRADA', 'ANULADA') AND NEW."estado" <> OLD."estado" THEN
    RAISE EXCEPTION 'La orden de trabajo terminal % no puede cambiar de estado', OLD."id";
  END IF;
  IF NEW."estado" = 'ANULADA' AND OLD."estado" <> 'ANULADA' THEN
    IF OLD."estado" NOT IN ('PENDIENTE_ASIGNACION', 'ASIGNADA')
      OR EXISTS (SELECT 1 FROM "intervenciones" WHERE "orden_trabajo_id" = NEW."id")
      OR EXISTS (SELECT 1 FROM "actividades_orden" a JOIN "intervenciones" i ON i."id" = a."intervencion_id" WHERE i."orden_trabajo_id" = NEW."id")
      OR EXISTS (SELECT 1 FROM "consumos_repuesto" WHERE "orden_trabajo_id" = NEW."id") THEN
      RAISE EXCEPTION 'La orden % tiene ejecución y no puede anularse', NEW."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
