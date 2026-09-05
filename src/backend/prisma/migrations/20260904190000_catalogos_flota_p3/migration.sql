-- P3 adds normalized business uniqueness and safe lifecycle defaults to the
-- catalog tables created by the already-applied technical foundation migration.
ALTER TABLE "modelos_bus"
  ALTER COLUMN "activo" SET DEFAULT true;

ALTER TABLE "rutas"
  ALTER COLUMN "activa" SET DEFAULT true;

CREATE UNIQUE INDEX "modelos_bus_identidad_normalizada_key"
  ON "modelos_bus" (
    lower(btrim("marca")),
    lower(btrim("nombre_modelo")),
    lower(COALESCE(NULLIF(btrim("version_tecnica"), ''), ''))
  );

CREATE UNIQUE INDEX "rutas_codigo_normalizado_key"
  ON "rutas" (upper(btrim("codigo")));

ALTER TABLE "modelos_bus"
  ADD CONSTRAINT "modelos_bus_marca_no_vacia_check"
    CHECK (char_length(btrim("marca")) > 0),
  ADD CONSTRAINT "modelos_bus_nombre_no_vacio_check"
    CHECK (char_length(btrim("nombre_modelo")) > 0),
  ADD CONSTRAINT "modelos_bus_especificaciones_objeto_check"
    CHECK (jsonb_typeof("especificaciones") = 'object');

ALTER TABLE "rutas"
  ADD CONSTRAINT "rutas_codigo_no_vacio_check"
    CHECK (char_length(btrim("codigo")) > 0),
  ADD CONSTRAINT "rutas_nombre_no_vacio_check"
    CHECK (char_length(btrim("nombre")) > 0),
  ADD CONSTRAINT "rutas_origen_no_vacio_check"
    CHECK (char_length(btrim("origen")) > 0),
  ADD CONSTRAINT "rutas_destino_no_vacio_check"
    CHECK (char_length(btrim("destino")) > 0);
