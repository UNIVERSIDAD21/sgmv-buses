-- P2-10: additive PostgreSQL store for the HTTP Idempotency-Key contract.
CREATE TYPE "estado_solicitud_idempotente" AS ENUM ('EN_PROCESO', 'COMPLETADA');

CREATE TABLE "solicitudes_idempotentes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "metodo" VARCHAR(10) NOT NULL,
    "ruta_plantilla" VARCHAR(255) NOT NULL,
    "operacion" VARCHAR(280) NOT NULL,
    "clave" UUID NOT NULL,
    "hash_solicitud" CHAR(64) NOT NULL,
    "estado" "estado_solicitud_idempotente" NOT NULL DEFAULT 'EN_PROCESO',
    "status_http" SMALLINT,
    "respuesta_segura" JSONB,
    "recurso_tipo" VARCHAR(100),
    "recurso_id" VARCHAR(120),
    "request_id" UUID NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "completada_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_idempotentes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_solicitudes_idempotentes_hash" CHECK ("hash_solicitud" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ck_solicitudes_idempotentes_terminal" CHECK (
        ("estado" = 'EN_PROCESO' AND "status_http" IS NULL AND "respuesta_segura" IS NULL AND "completada_at" IS NULL)
        OR
        ("estado" = 'COMPLETADA' AND "status_http" IS NOT NULL AND "respuesta_segura" IS NOT NULL AND "completada_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "ux_solicitudes_idempotentes_alcance"
ON "solicitudes_idempotentes"("actor_id", "metodo", "ruta_plantilla", "clave");

CREATE INDEX "solicitudes_idempotentes_estado_expira_at_idx"
ON "solicitudes_idempotentes"("estado", "expira_at");

CREATE INDEX "solicitudes_idempotentes_request_id_idx"
ON "solicitudes_idempotentes"("request_id");

ALTER TABLE "solicitudes_idempotentes"
ADD CONSTRAINT "solicitudes_idempotentes_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
