-- RF-05 requires backend protection against duplicate administrative inventory
-- commands. The key is nullable to preserve RF-01 to RF-04 data and unique only
-- when an entry or adjustment command provides it.

ALTER TABLE "movimientos_inventario"
ADD COLUMN "clave_idempotencia" UUID;

CREATE UNIQUE INDEX "ux_movimientos_inventario_clave_idempotencia"
ON "movimientos_inventario"("clave_idempotencia")
WHERE "clave_idempotencia" IS NOT NULL;
