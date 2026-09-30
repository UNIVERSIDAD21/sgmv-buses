CREATE TYPE "continuidad_informada" AS ENUM ('SI', 'NO', 'INDETERMINADA');

ALTER TABLE "novedades"
  ADD COLUMN "continuidad_informada" "continuidad_informada";

ALTER TYPE "tipo_alerta" ADD VALUE IF NOT EXISTS 'CONTINUIDAD_INTERRUMPIDA';
