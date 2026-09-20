CREATE TYPE "estado_evidencia_novedad" AS ENUM ('PENDIENTE', 'ACTIVA', 'ELIMINADA', 'FALLIDA');

CREATE TABLE "evidencias_novedad" (
    "id" SERIAL NOT NULL,
    "novedad_id" INTEGER NOT NULL,
    "carga_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "nombre_original" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "ancho" INTEGER,
    "alto" INTEGER,
    "estado" "estado_evidencia_novedad" NOT NULL DEFAULT 'PENDIENTE',
    "storage_public_id" VARCHAR(255),
    "storage_asset_id" VARCHAR(255),
    "storage_version" VARCHAR(30),
    "cargada_por_id" INTEGER NOT NULL,
    "activada_at" TIMESTAMPTZ(6),
    "eliminada_at" TIMESTAMPTZ(6),
    "eliminada_por_id" INTEGER,
    "motivo_eliminacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "evidencias_novedad_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_evidencia_novedad_ordinal" CHECK ("ordinal" BETWEEN 0 AND 4),
    CONSTRAINT "ck_evidencia_novedad_bytes" CHECK ("bytes" BETWEEN 1 AND 5242880),
    CONSTRAINT "ck_evidencia_novedad_mime" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "ck_evidencia_novedad_dimensiones" CHECK (
      ("ancho" IS NULL AND "alto" IS NULL) OR ("ancho" > 0 AND "alto" > 0)
    ),
    CONSTRAINT "ck_evidencia_novedad_estado_storage" CHECK (
      ("estado" = 'PENDIENTE' AND "storage_public_id" IS NULL AND "storage_asset_id" IS NULL AND "activada_at" IS NULL AND "eliminada_at" IS NULL)
      OR ("estado" = 'ACTIVA' AND "storage_public_id" IS NOT NULL AND "storage_asset_id" IS NOT NULL AND "storage_version" IS NOT NULL AND "activada_at" IS NOT NULL AND "eliminada_at" IS NULL AND "eliminada_por_id" IS NULL AND "motivo_eliminacion" IS NULL)
      OR ("estado" = 'ELIMINADA' AND "storage_public_id" IS NOT NULL AND "storage_asset_id" IS NOT NULL AND "storage_version" IS NOT NULL AND "activada_at" IS NOT NULL AND "eliminada_at" IS NOT NULL AND "eliminada_por_id" IS NOT NULL AND length(btrim("motivo_eliminacion")) >= 10)
      OR ("estado" = 'FALLIDA' AND "eliminada_at" IS NULL AND "eliminada_por_id" IS NULL)
    )
);

CREATE UNIQUE INDEX "evidencias_novedad_carga_id_ordinal_key"
ON "evidencias_novedad"("carga_id", "ordinal");

CREATE UNIQUE INDEX "evidencias_novedad_storage_public_id_key"
ON "evidencias_novedad"("storage_public_id");

CREATE UNIQUE INDEX "evidencias_novedad_storage_asset_id_key"
ON "evidencias_novedad"("storage_asset_id");

CREATE INDEX "evidencias_novedad_novedad_id_estado_created_at_idx"
ON "evidencias_novedad"("novedad_id", "estado", "created_at");

CREATE INDEX "evidencias_novedad_cargada_por_id_idx"
ON "evidencias_novedad"("cargada_por_id");

CREATE INDEX "evidencias_novedad_eliminada_por_id_idx"
ON "evidencias_novedad"("eliminada_por_id");

ALTER TABLE "evidencias_novedad"
ADD CONSTRAINT "evidencias_novedad_novedad_id_fkey"
FOREIGN KEY ("novedad_id") REFERENCES "novedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidencias_novedad"
ADD CONSTRAINT "evidencias_novedad_cargada_por_id_fkey"
FOREIGN KEY ("cargada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidencias_novedad"
ADD CONSTRAINT "evidencias_novedad_eliminada_por_id_fkey"
FOREIGN KEY ("eliminada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
