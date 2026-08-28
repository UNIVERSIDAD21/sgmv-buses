-- RF-04 requires backend protection against double submission of spare-part
-- consumptions. The key is nullable to preserve existing historical rows and
-- unique only when provided by RF-04 clients.

ALTER TABLE "consumos_repuesto"
ADD COLUMN "clave_idempotencia" UUID;

CREATE UNIQUE INDEX "ux_consumos_repuesto_clave_idempotencia"
ON "consumos_repuesto"("clave_idempotencia")
WHERE "clave_idempotencia" IS NOT NULL;
