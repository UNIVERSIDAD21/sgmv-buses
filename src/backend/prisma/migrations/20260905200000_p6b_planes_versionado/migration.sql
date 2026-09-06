-- P6-B: identidad histórica y versión activa única para planes preventivos.
-- Se conserva toda versión previa; únicamente una versión activa puede resolver
-- una misma tarea para un mismo destino.

CREATE UNIQUE INDEX "ux_p6_plan_bus_clave_version"
  ON "planes_mantenimiento_preventivo" ("bus_id", upper(btrim("clave_tarea")), "version")
  WHERE "bus_id" IS NOT NULL;

CREATE UNIQUE INDEX "ux_p6_plan_modelo_clave_version"
  ON "planes_mantenimiento_preventivo" ("modelo_bus_id", upper(btrim("clave_tarea")), "version")
  WHERE "modelo_bus_id" IS NOT NULL;

CREATE UNIQUE INDEX "ux_p6_plan_bus_clave_activo"
  ON "planes_mantenimiento_preventivo" ("bus_id", upper(btrim("clave_tarea")))
  WHERE "activo" AND "bus_id" IS NOT NULL;

CREATE UNIQUE INDEX "ux_p6_plan_modelo_clave_activo"
  ON "planes_mantenimiento_preventivo" ("modelo_bus_id", upper(btrim("clave_tarea")))
  WHERE "activo" AND "modelo_bus_id" IS NOT NULL;
