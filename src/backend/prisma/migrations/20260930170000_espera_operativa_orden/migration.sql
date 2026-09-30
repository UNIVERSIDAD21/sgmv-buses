-- La espera no es un nuevo estado de OT: conserva EN_EJECUCION y la intervención.
CREATE TYPE "tipo_espera_orden" AS ENUM ('REPUESTO', 'AUTORIZACION');
ALTER TYPE "tipo_alerta" ADD VALUE 'ORDEN_EN_ESPERA';

ALTER TABLE "ordenes_trabajo"
  ADD COLUMN "espera_tipo" "tipo_espera_orden",
  ADD COLUMN "espera_motivo" TEXT,
  ADD COLUMN "espera_desde" TIMESTAMPTZ,
  ADD COLUMN "espera_registrada_por_id" INTEGER;

ALTER TABLE "ordenes_trabajo"
  ADD CONSTRAINT "ck_orden_espera_completa"
  CHECK (
    ("espera_tipo" IS NULL AND "espera_motivo" IS NULL AND "espera_desde" IS NULL
      AND "espera_registrada_por_id" IS NULL)
    OR ("espera_tipo" IS NOT NULL AND "espera_motivo" IS NOT NULL
      AND length(btrim("espera_motivo")) >= 3 AND "espera_desde" IS NOT NULL
      AND "espera_registrada_por_id" IS NOT NULL AND "estado" = 'EN_EJECUCION')
  ),
  ADD CONSTRAINT "ordenes_trabajo_espera_registrada_por_id_fkey"
  FOREIGN KEY ("espera_registrada_por_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ordenes_trabajo_espera_registrada_por_id_idx"
  ON "ordenes_trabajo"("espera_registrada_por_id");
