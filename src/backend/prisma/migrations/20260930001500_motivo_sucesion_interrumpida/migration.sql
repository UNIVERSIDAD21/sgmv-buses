ALTER TABLE "jornadas_operativas" ADD COLUMN "motivo_sucesion" TEXT;
ALTER TABLE "jornadas_operativas"
  ADD CONSTRAINT "ck_obj_jornada_motivo_sucesion" CHECK (
    motivo_sucesion IS NULL OR
    (jornada_anterior_id IS NOT NULL AND length(btrim(motivo_sucesion)) >= 3)
  );
