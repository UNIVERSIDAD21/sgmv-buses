ALTER TYPE "estado_usuario" RENAME TO "estado_usuario_anterior";
CREATE TYPE "estado_usuario" AS ENUM (
  'PENDIENTE_ACTIVACION',
  'ACTIVO',
  'BLOQUEADO',
  'INACTIVO'
);

ALTER TABLE "usuarios"
  ALTER COLUMN "estado" DROP DEFAULT,
  ALTER COLUMN "estado" TYPE "estado_usuario"
    USING ("estado"::text::"estado_usuario"),
  ALTER COLUMN "estado" SET DEFAULT 'ACTIVO';

DROP TYPE "estado_usuario_anterior";

ALTER TABLE "usuarios"
  ALTER COLUMN "contrasena_hash" DROP NOT NULL;

ALTER TABLE "usuarios"
  ADD CONSTRAINT "ck_usuarios_contrasena_estado"
  CHECK (
    ("estado" <> 'ACTIVO' OR "contrasena_hash" IS NOT NULL)
    AND ("estado" <> 'PENDIENTE_ACTIVACION' OR "contrasena_hash" IS NULL)
  );

CREATE TABLE "tokens_activacion_cuenta" (
  "id" SERIAL NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expira_at" TIMESTAMPTZ(6) NOT NULL,
  "usado_at" TIMESTAMPTZ(6),
  "creado_por_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tokens_activacion_cuenta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_token_activacion_expiracion" CHECK ("expira_at" > "created_at"),
  CONSTRAINT "ck_token_activacion_uso" CHECK ("usado_at" IS NULL OR "usado_at" >= "created_at")
);

CREATE UNIQUE INDEX "tokens_activacion_cuenta_token_hash_key"
  ON "tokens_activacion_cuenta"("token_hash");
CREATE INDEX "tokens_activacion_cuenta_usuario_id_created_at_idx"
  ON "tokens_activacion_cuenta"("usuario_id", "created_at");
CREATE INDEX "tokens_activacion_cuenta_expira_at_idx"
  ON "tokens_activacion_cuenta"("expira_at");
CREATE INDEX "tokens_activacion_cuenta_creado_por_id_idx"
  ON "tokens_activacion_cuenta"("creado_por_id");

ALTER TABLE "tokens_activacion_cuenta"
  ADD CONSTRAINT "tokens_activacion_cuenta_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tokens_activacion_cuenta"
  ADD CONSTRAINT "tokens_activacion_cuenta_creado_por_id_fkey"
  FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
