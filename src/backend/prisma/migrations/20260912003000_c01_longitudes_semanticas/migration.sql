-- C-01: physical lengths aligned to the relational model without changing domain semantics.
-- Fail atomically if any existing value exceeds a target; never truncate.
BEGIN;
LOCK TABLE "roles" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "usuarios" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "buses" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "ordenes_trabajo" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "rutas" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "planes_mantenimiento_preventivo" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "roles" WHERE char_length("nombre") > 80) THEN
  RAISE EXCEPTION 'C-01: roles.nombre exceeds target 80; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "roles" WHERE char_length("descripcion") > 255) THEN
  RAISE EXCEPTION 'C-01: roles.descripcion exceeds target 255; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "usuarios" WHERE char_length("nombre") > 120) THEN
  RAISE EXCEPTION 'C-01: usuarios.nombre exceeds target 120; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "usuarios" WHERE char_length("email") > 120) THEN
  RAISE EXCEPTION 'C-01: usuarios.email exceeds target 120; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "usuarios" WHERE char_length("telefono") > 20) THEN
  RAISE EXCEPTION 'C-01: usuarios.telefono exceeds target 20; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "buses" WHERE char_length("codigo_interno") > 50) THEN
  RAISE EXCEPTION 'C-01: buses.codigo_interno exceeds target 50; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "buses" WHERE char_length("placa") > 15) THEN
  RAISE EXCEPTION 'C-01: buses.placa exceeds target 15; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "ordenes_trabajo" WHERE char_length("codigo") > 50) THEN
  RAISE EXCEPTION 'C-01: ordenes_trabajo.codigo exceeds target 50; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "rutas" WHERE char_length("codigo") > 50) THEN
  RAISE EXCEPTION 'C-01: rutas.codigo exceeds target 50; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "rutas" WHERE char_length("nombre") > 120) THEN
  RAISE EXCEPTION 'C-01: rutas.nombre exceeds target 120; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "rutas" WHERE char_length("origen") > 120) THEN
  RAISE EXCEPTION 'C-01: rutas.origen exceeds target 120; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "rutas" WHERE char_length("destino") > 120) THEN
  RAISE EXCEPTION 'C-01: rutas.destino exceeds target 120; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "planes_mantenimiento_preventivo" WHERE char_length("clave_tarea") > 80) THEN
  RAISE EXCEPTION 'C-01: planes_mantenimiento_preventivo.clave_tarea exceeds target 80; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
 IF EXISTS (SELECT 1 FROM "planes_mantenimiento_preventivo" WHERE char_length("componente") > 120) THEN
  RAISE EXCEPTION 'C-01: planes_mantenimiento_preventivo.componente exceeds target 120; preserve data and review before migration' USING ERRCODE='22001';
 END IF;
END $$;
ALTER TABLE "roles" ALTER COLUMN "nombre" TYPE VARCHAR(80);
ALTER TABLE "roles" ALTER COLUMN "descripcion" TYPE VARCHAR(255);
ALTER TABLE "usuarios" ALTER COLUMN "nombre" TYPE VARCHAR(120);
ALTER TABLE "usuarios" ALTER COLUMN "email" TYPE VARCHAR(120);
ALTER TABLE "usuarios" ALTER COLUMN "telefono" TYPE VARCHAR(20);
ALTER TABLE "buses" ALTER COLUMN "codigo_interno" TYPE VARCHAR(50);
ALTER TABLE "buses" ALTER COLUMN "placa" TYPE VARCHAR(15);
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "codigo" TYPE VARCHAR(50);
ALTER TABLE "rutas" ALTER COLUMN "codigo" TYPE VARCHAR(50);
ALTER TABLE "rutas" ALTER COLUMN "nombre" TYPE VARCHAR(120);
ALTER TABLE "rutas" ALTER COLUMN "origen" TYPE VARCHAR(120);
ALTER TABLE "rutas" ALTER COLUMN "destino" TYPE VARCHAR(120);
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN "clave_tarea" TYPE VARCHAR(80);
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN "componente" TYPE VARCHAR(120);
COMMIT;
