ALTER TABLE "buses"
  ADD COLUMN "empresa_operadora" VARCHAR(160),
  ADD COLUMN "origen_datos" VARCHAR(24) NOT NULL DEFAULT 'NO_VERIFICADO',
  ADD COLUMN "fuente_datos" VARCHAR(1000);

ALTER TABLE "buses" ADD CONSTRAINT "bus_origen_datos_valido"
  CHECK ("origen_datos" IN ('NO_VERIFICADO', 'SIMULADO_SGMV', 'REAL_DOCUMENTADO'));
ALTER TABLE "buses" ADD CONSTRAINT "bus_real_exige_fuente"
  CHECK ("origen_datos" <> 'REAL_DOCUMENTADO' OR length(trim("fuente_datos")) >= 10 AND "fuente_datos" IS NOT NULL);
CREATE INDEX "buses_empresa_operadora_idx" ON "buses" ("empresa_operadora");
