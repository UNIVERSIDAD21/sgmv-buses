-- En PostgreSQL, CHECK acepta NULL; exigirlo explícitamente para FABRICANTE.
ALTER TABLE "planes_mantenimiento_preventivo"
  DROP CONSTRAINT "ck_plan_referencia_fabricante";

ALTER TABLE "planes_mantenimiento_preventivo"
  ADD CONSTRAINT "ck_plan_referencia_fabricante"
  CHECK (
    "origen_regla" <> 'FABRICANTE' OR
    ("referencia_regla" IS NOT NULL AND length(btrim("referencia_regla")) >= 10)
  );
