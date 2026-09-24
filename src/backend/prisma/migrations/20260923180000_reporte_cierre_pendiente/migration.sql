ALTER TABLE "jornadas_operativas"
  ADD COLUMN "cierre_reportado_at" TIMESTAMPTZ(6),
  ADD COLUMN "motivo_cierre_pendiente" VARCHAR(500),
  ADD CONSTRAINT "ck_jornada_reporte_cierre" CHECK (
    (cierre_reportado_at IS NULL AND motivo_cierre_pendiente IS NULL)
    OR (cierre_reportado_at IS NOT NULL AND motivo_cierre_pendiente IS NOT NULL
        AND length(btrim(motivo_cierre_pendiente)) >= 10)
  );

CREATE INDEX "ix_jornada_cierre_pendiente" ON "jornadas_operativas" (fin_programado)
  WHERE estado = 'EN_CURSO' AND fin_real IS NULL;
