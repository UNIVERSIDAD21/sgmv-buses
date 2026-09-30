-- La procedencia no se infiere para planes históricos ni se inventa un fabricante.
CREATE TYPE "origen_regla_preventiva" AS ENUM ('SIN_REFERENCIA', 'DEMO_ACADEMICA', 'FABRICANTE');

ALTER TABLE "planes_mantenimiento_preventivo"
  ADD COLUMN "origen_regla" "origen_regla_preventiva" NOT NULL DEFAULT 'SIN_REFERENCIA',
  ADD COLUMN "referencia_regla" VARCHAR(500);

ALTER TABLE "planes_mantenimiento_preventivo"
  ADD CONSTRAINT "ck_plan_referencia_fabricante"
  CHECK ("origen_regla" <> 'FABRICANTE' OR length(btrim("referencia_regla")) >= 10);
