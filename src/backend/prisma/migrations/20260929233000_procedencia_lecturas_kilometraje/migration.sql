ALTER TABLE "lecturas_kilometraje"
  ADD COLUMN "observado_por_id" INTEGER,
  ADD COLUMN "motivo_respaldo" TEXT,
  ADD COLUMN "contexto" VARCHAR(80);

CREATE INDEX "lecturas_kilometraje_observado_por_id_idx"
  ON "lecturas_kilometraje"("observado_por_id");

ALTER TABLE "lecturas_kilometraje"
  ADD CONSTRAINT "lecturas_kilometraje_observado_por_id_fkey"
  FOREIGN KEY ("observado_por_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
