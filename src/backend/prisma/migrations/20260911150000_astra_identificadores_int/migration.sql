-- ASTRA: forward-only entity UUID -> Int. Technical UUID keys remain unchanged.
-- Requires exclusive maintenance window; apply only locally until a production plan is approved.
BEGIN;
CREATE TEMP TABLE astra_id_map (table_name text NOT NULL, old_id uuid NOT NULL, new_id integer NOT NULL,
  PRIMARY KEY(table_name,old_id), UNIQUE(table_name,new_id)) ON COMMIT DROP;
CREATE FUNCTION pg_temp.astra_int(p_table text,p_old uuid) RETURNS integer LANGUAGE sql STABLE STRICT AS
  'SELECT new_id FROM pg_temp.astra_id_map WHERE table_name=p_table AND old_id=p_old';
LOCK TABLE "roles" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'roles',id,(row_number() OVER(ORDER BY id))::integer FROM "roles";
LOCK TABLE "usuarios" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'usuarios',id,(row_number() OVER(ORDER BY id))::integer FROM "usuarios";
LOCK TABLE "buses" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'buses',id,(row_number() OVER(ORDER BY id))::integer FROM "buses";
LOCK TABLE "lecturas_kilometraje" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'lecturas_kilometraje',id,(row_number() OVER(ORDER BY id))::integer FROM "lecturas_kilometraje";
LOCK TABLE "bus_estado_historial" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'bus_estado_historial',id,(row_number() OVER(ORDER BY id))::integer FROM "bus_estado_historial";
LOCK TABLE "asignaciones_conductor" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'asignaciones_conductor',id,(row_number() OVER(ORDER BY id))::integer FROM "asignaciones_conductor";
LOCK TABLE "novedades" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'novedades',id,(row_number() OVER(ORDER BY id))::integer FROM "novedades";
LOCK TABLE "programaciones_mantenimiento" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'programaciones_mantenimiento',id,(row_number() OVER(ORDER BY id))::integer FROM "programaciones_mantenimiento";
LOCK TABLE "ordenes_trabajo" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'ordenes_trabajo',id,(row_number() OVER(ORDER BY id))::integer FROM "ordenes_trabajo";
LOCK TABLE "intervenciones" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'intervenciones',id,(row_number() OVER(ORDER BY id))::integer FROM "intervenciones";
LOCK TABLE "actividades_orden" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'actividades_orden',id,(row_number() OVER(ORDER BY id))::integer FROM "actividades_orden";
LOCK TABLE "orden_estado_historial" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'orden_estado_historial',id,(row_number() OVER(ORDER BY id))::integer FROM "orden_estado_historial";
LOCK TABLE "orden_reasignaciones" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'orden_reasignaciones',id,(row_number() OVER(ORDER BY id))::integer FROM "orden_reasignaciones";
LOCK TABLE "repuestos" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'repuestos',id,(row_number() OVER(ORDER BY id))::integer FROM "repuestos";
LOCK TABLE "consumos_repuesto" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'consumos_repuesto',id,(row_number() OVER(ORDER BY id))::integer FROM "consumos_repuesto";
LOCK TABLE "autorizaciones_excepcion_consumo" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'autorizaciones_excepcion_consumo',id,(row_number() OVER(ORDER BY id))::integer FROM "autorizaciones_excepcion_consumo";
LOCK TABLE "movimientos_inventario" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'movimientos_inventario',id,(row_number() OVER(ORDER BY id))::integer FROM "movimientos_inventario";
LOCK TABLE "modelos_bus" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'modelos_bus',id,(row_number() OVER(ORDER BY id))::integer FROM "modelos_bus";
LOCK TABLE "rutas" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'rutas',id,(row_number() OVER(ORDER BY id))::integer FROM "rutas";
LOCK TABLE "jornadas_operativas" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'jornadas_operativas',id,(row_number() OVER(ORDER BY id))::integer FROM "jornadas_operativas";
LOCK TABLE "planes_mantenimiento_preventivo" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'planes_mantenimiento_preventivo',id,(row_number() OVER(ORDER BY id))::integer FROM "planes_mantenimiento_preventivo";
LOCK TABLE "compatibilidades_repuesto" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'compatibilidades_repuesto',id,(row_number() OVER(ORDER BY id))::integer FROM "compatibilidades_repuesto";
LOCK TABLE "alertas_internas" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'alertas_internas',id,(row_number() OVER(ORDER BY id))::integer FROM "alertas_internas";
LOCK TABLE "alertas_destinatarios" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'alertas_destinatarios',id,(row_number() OVER(ORDER BY id))::integer FROM "alertas_destinatarios";
LOCK TABLE "eventos_auditoria" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'eventos_auditoria',id,(row_number() OVER(ORDER BY id))::integer FROM "eventos_auditoria";
LOCK TABLE "solicitudes_idempotentes" IN ACCESS EXCLUSIVE MODE;
INSERT INTO astra_id_map SELECT 'solicitudes_idempotentes',id,(row_number() OVER(ORDER BY id))::integer FROM "solicitudes_idempotentes";
CREATE TEMP TABLE astra_fks ON COMMIT DROP AS
SELECT conrelid::regclass::text AS tbl,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM astra_fks LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.tbl,r.conname);
  END LOOP;
END $$;
CREATE TEMP TABLE astra_checks ON COMMIT DROP AS
SELECT conrelid::regclass::text AS tbl,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM astra_checks LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.tbl,r.conname); END LOOP;
END $$;
CREATE TEMP TABLE astra_triggers ON COMMIT DROP AS
SELECT tgrelid::regclass::text AS tbl,tgname,pg_get_triggerdef(oid) AS definition,tgenabled
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM astra_triggers LOOP EXECUTE format('DROP TRIGGER %I ON %s',r.tgname,r.tbl); END LOOP;
END $$;
ALTER TABLE "roles" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "roles" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('roles',"id");
ALTER TABLE "usuarios" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('usuarios',"id");
ALTER TABLE "usuarios" ALTER COLUMN "rol_id" TYPE integer USING pg_temp.astra_int('roles',"rol_id");
ALTER TABLE "buses" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "buses" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('buses',"id");
ALTER TABLE "buses" ALTER COLUMN "modelo_bus_id" TYPE integer USING pg_temp.astra_int('modelos_bus',"modelo_bus_id");
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('lecturas_kilometraje',"id");
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN "registrado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"registrado_por_id");
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN "jornada_operativa_id" TYPE integer USING pg_temp.astra_int('jornadas_operativas',"jornada_operativa_id");
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN "orden_trabajo_id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"orden_trabajo_id");
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN "intervencion_id" TYPE integer USING pg_temp.astra_int('intervenciones',"intervencion_id");
ALTER TABLE "bus_estado_historial" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "bus_estado_historial" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('bus_estado_historial',"id");
ALTER TABLE "bus_estado_historial" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "bus_estado_historial" ALTER COLUMN "cambiado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"cambiado_por_id");
ALTER TABLE "asignaciones_conductor" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "asignaciones_conductor" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('asignaciones_conductor',"id");
ALTER TABLE "asignaciones_conductor" ALTER COLUMN "conductor_id" TYPE integer USING pg_temp.astra_int('usuarios',"conductor_id");
ALTER TABLE "asignaciones_conductor" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "asignaciones_conductor" ALTER COLUMN "asignado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"asignado_por_id");
ALTER TABLE "novedades" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "novedades" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('novedades',"id");
ALTER TABLE "novedades" ALTER COLUMN "conductor_id" TYPE integer USING pg_temp.astra_int('usuarios',"conductor_id");
ALTER TABLE "novedades" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "novedades" ALTER COLUMN "revisada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"revisada_por_id");
ALTER TABLE "novedades" ALTER COLUMN "jornada_operativa_id" TYPE integer USING pg_temp.astra_int('jornadas_operativas',"jornada_operativa_id");
ALTER TABLE "novedades" ALTER COLUMN "lectura_kilometraje_id" TYPE integer USING pg_temp.astra_int('lecturas_kilometraje',"lectura_kilometraje_id");
ALTER TABLE "programaciones_mantenimiento" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "programaciones_mantenimiento" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('programaciones_mantenimiento',"id");
ALTER TABLE "programaciones_mantenimiento" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "programaciones_mantenimiento" ALTER COLUMN "creada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"creada_por_id");
ALTER TABLE "programaciones_mantenimiento" ALTER COLUMN "plan_mantenimiento_preventivo_id" TYPE integer USING pg_temp.astra_int('planes_mantenimiento_preventivo',"plan_mantenimiento_preventivo_id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "tecnico_asignado_id" TYPE integer USING pg_temp.astra_int('usuarios',"tecnico_asignado_id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "creada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"creada_por_id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "cerrada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"cerrada_por_id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "novedad_id" TYPE integer USING pg_temp.astra_int('novedades',"novedad_id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "programacion_mantenimiento_id" TYPE integer USING pg_temp.astra_int('programaciones_mantenimiento',"programacion_mantenimiento_id");
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "jornada_operativa_id" TYPE integer USING pg_temp.astra_int('jornadas_operativas',"jornada_operativa_id");
ALTER TABLE "intervenciones" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "intervenciones" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('intervenciones',"id");
ALTER TABLE "intervenciones" ALTER COLUMN "orden_trabajo_id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"orden_trabajo_id");
ALTER TABLE "intervenciones" ALTER COLUMN "tecnico_id" TYPE integer USING pg_temp.astra_int('usuarios',"tecnico_id");
ALTER TABLE "actividades_orden" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "actividades_orden" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('actividades_orden',"id");
ALTER TABLE "actividades_orden" ALTER COLUMN "intervencion_id" TYPE integer USING pg_temp.astra_int('intervenciones',"intervencion_id");
ALTER TABLE "actividades_orden" ALTER COLUMN "registrada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"registrada_por_id");
ALTER TABLE "orden_estado_historial" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "orden_estado_historial" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('orden_estado_historial',"id");
ALTER TABLE "orden_estado_historial" ALTER COLUMN "orden_trabajo_id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"orden_trabajo_id");
ALTER TABLE "orden_estado_historial" ALTER COLUMN "cambiado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"cambiado_por_id");
ALTER TABLE "orden_reasignaciones" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "orden_reasignaciones" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('orden_reasignaciones',"id");
ALTER TABLE "orden_reasignaciones" ALTER COLUMN "orden_trabajo_id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"orden_trabajo_id");
ALTER TABLE "orden_reasignaciones" ALTER COLUMN "tecnico_anterior_id" TYPE integer USING pg_temp.astra_int('usuarios',"tecnico_anterior_id");
ALTER TABLE "orden_reasignaciones" ALTER COLUMN "tecnico_nuevo_id" TYPE integer USING pg_temp.astra_int('usuarios',"tecnico_nuevo_id");
ALTER TABLE "orden_reasignaciones" ALTER COLUMN "reasignado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"reasignado_por_id");
ALTER TABLE "repuestos" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "repuestos" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('repuestos',"id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "consumos_repuesto" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('consumos_repuesto',"id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN "orden_trabajo_id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"orden_trabajo_id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN "repuesto_id" TYPE integer USING pg_temp.astra_int('repuestos',"repuesto_id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN "consumido_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"consumido_por_id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN "intervencion_id" TYPE integer USING pg_temp.astra_int('intervenciones',"intervencion_id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN "regla_compatibilidad_id" TYPE integer USING pg_temp.astra_int('compatibilidades_repuesto',"regla_compatibilidad_id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN "autorizado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"autorizado_por_id");
ALTER TABLE "consumos_repuesto" ALTER COLUMN "autorizacion_excepcion_id" TYPE integer USING pg_temp.astra_int('autorizaciones_excepcion_consumo',"autorizacion_excepcion_id");
ALTER TABLE "autorizaciones_excepcion_consumo" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "autorizaciones_excepcion_consumo" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('autorizaciones_excepcion_consumo',"id");
ALTER TABLE "autorizaciones_excepcion_consumo" ALTER COLUMN "orden_trabajo_id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"orden_trabajo_id");
ALTER TABLE "autorizaciones_excepcion_consumo" ALTER COLUMN "intervencion_id" TYPE integer USING pg_temp.astra_int('intervenciones',"intervencion_id");
ALTER TABLE "autorizaciones_excepcion_consumo" ALTER COLUMN "repuesto_id" TYPE integer USING pg_temp.astra_int('repuestos',"repuesto_id");
ALTER TABLE "autorizaciones_excepcion_consumo" ALTER COLUMN "autorizado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"autorizado_por_id");
ALTER TABLE "movimientos_inventario" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "movimientos_inventario" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('movimientos_inventario',"id");
ALTER TABLE "movimientos_inventario" ALTER COLUMN "repuesto_id" TYPE integer USING pg_temp.astra_int('repuestos',"repuesto_id");
ALTER TABLE "movimientos_inventario" ALTER COLUMN "responsable_id" TYPE integer USING pg_temp.astra_int('usuarios',"responsable_id");
ALTER TABLE "movimientos_inventario" ALTER COLUMN "consumo_repuesto_id" TYPE integer USING pg_temp.astra_int('consumos_repuesto',"consumo_repuesto_id");
ALTER TABLE "modelos_bus" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "modelos_bus" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('modelos_bus',"id");
ALTER TABLE "rutas" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "rutas" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('rutas',"id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "jornadas_operativas" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('jornadas_operativas',"id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "conductor_id" TYPE integer USING pg_temp.astra_int('usuarios',"conductor_id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "ruta_id" TYPE integer USING pg_temp.astra_int('rutas',"ruta_id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "programada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"programada_por_id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "cambio_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"cambio_por_id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "iniciada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"iniciada_por_id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "finalizada_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"finalizada_por_id");
ALTER TABLE "jornadas_operativas" ALTER COLUMN "jornada_anterior_id" TYPE integer USING pg_temp.astra_int('jornadas_operativas',"jornada_anterior_id");
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('planes_mantenimiento_preventivo',"id");
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN "modelo_bus_id" TYPE integer USING pg_temp.astra_int('modelos_bus',"modelo_bus_id");
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN "creado_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"creado_por_id");
ALTER TABLE "compatibilidades_repuesto" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "compatibilidades_repuesto" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('compatibilidades_repuesto',"id");
ALTER TABLE "compatibilidades_repuesto" ALTER COLUMN "repuesto_id" TYPE integer USING pg_temp.astra_int('repuestos',"repuesto_id");
ALTER TABLE "compatibilidades_repuesto" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "compatibilidades_repuesto" ALTER COLUMN "modelo_bus_id" TYPE integer USING pg_temp.astra_int('modelos_bus',"modelo_bus_id");
ALTER TABLE "compatibilidades_repuesto" ALTER COLUMN "definida_por_id" TYPE integer USING pg_temp.astra_int('usuarios',"definida_por_id");
ALTER TABLE "alertas_internas" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "alertas_internas" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('alertas_internas',"id");
ALTER TABLE "alertas_internas" ALTER COLUMN "bus_id" TYPE integer USING pg_temp.astra_int('buses',"bus_id");
ALTER TABLE "alertas_internas" ALTER COLUMN "jornada_operativa_id" TYPE integer USING pg_temp.astra_int('jornadas_operativas',"jornada_operativa_id");
ALTER TABLE "alertas_internas" ALTER COLUMN "novedad_id" TYPE integer USING pg_temp.astra_int('novedades',"novedad_id");
ALTER TABLE "alertas_internas" ALTER COLUMN "programacion_mantenimiento_id" TYPE integer USING pg_temp.astra_int('programaciones_mantenimiento',"programacion_mantenimiento_id");
ALTER TABLE "alertas_internas" ALTER COLUMN "orden_trabajo_id" TYPE integer USING pg_temp.astra_int('ordenes_trabajo',"orden_trabajo_id");
ALTER TABLE "alertas_internas" ALTER COLUMN "repuesto_id" TYPE integer USING pg_temp.astra_int('repuestos',"repuesto_id");
ALTER TABLE "alertas_destinatarios" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "alertas_destinatarios" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('alertas_destinatarios',"id");
ALTER TABLE "alertas_destinatarios" ALTER COLUMN "alerta_interna_id" TYPE integer USING pg_temp.astra_int('alertas_internas',"alerta_interna_id");
ALTER TABLE "alertas_destinatarios" ALTER COLUMN "usuario_id" TYPE integer USING pg_temp.astra_int('usuarios',"usuario_id");
ALTER TABLE "eventos_auditoria" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "eventos_auditoria" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('eventos_auditoria',"id");
ALTER TABLE "eventos_auditoria" ALTER COLUMN "actor_id" TYPE integer USING pg_temp.astra_int('usuarios',"actor_id");
ALTER TABLE "solicitudes_idempotentes" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "solicitudes_idempotentes" ALTER COLUMN "id" TYPE integer USING pg_temp.astra_int('solicitudes_idempotentes',"id");
ALTER TABLE "solicitudes_idempotentes" ALTER COLUMN "actor_id" TYPE integer USING pg_temp.astra_int('usuarios',"actor_id");
CREATE SEQUENCE "roles_id_seq" OWNED BY "roles".id;
ALTER TABLE "roles" ALTER COLUMN id SET DEFAULT nextval('roles_id_seq');
SELECT setval('roles_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "roles";
CREATE SEQUENCE "usuarios_id_seq" OWNED BY "usuarios".id;
ALTER TABLE "usuarios" ALTER COLUMN id SET DEFAULT nextval('usuarios_id_seq');
SELECT setval('usuarios_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "usuarios";
CREATE SEQUENCE "buses_id_seq" OWNED BY "buses".id;
ALTER TABLE "buses" ALTER COLUMN id SET DEFAULT nextval('buses_id_seq');
SELECT setval('buses_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "buses";
CREATE SEQUENCE "lecturas_kilometraje_id_seq" OWNED BY "lecturas_kilometraje".id;
ALTER TABLE "lecturas_kilometraje" ALTER COLUMN id SET DEFAULT nextval('lecturas_kilometraje_id_seq');
SELECT setval('lecturas_kilometraje_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "lecturas_kilometraje";
CREATE SEQUENCE "bus_estado_historial_id_seq" OWNED BY "bus_estado_historial".id;
ALTER TABLE "bus_estado_historial" ALTER COLUMN id SET DEFAULT nextval('bus_estado_historial_id_seq');
SELECT setval('bus_estado_historial_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "bus_estado_historial";
CREATE SEQUENCE "asignaciones_conductor_id_seq" OWNED BY "asignaciones_conductor".id;
ALTER TABLE "asignaciones_conductor" ALTER COLUMN id SET DEFAULT nextval('asignaciones_conductor_id_seq');
SELECT setval('asignaciones_conductor_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "asignaciones_conductor";
CREATE SEQUENCE "novedades_id_seq" OWNED BY "novedades".id;
ALTER TABLE "novedades" ALTER COLUMN id SET DEFAULT nextval('novedades_id_seq');
SELECT setval('novedades_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "novedades";
CREATE SEQUENCE "programaciones_mantenimiento_id_seq" OWNED BY "programaciones_mantenimiento".id;
ALTER TABLE "programaciones_mantenimiento" ALTER COLUMN id SET DEFAULT nextval('programaciones_mantenimiento_id_seq');
SELECT setval('programaciones_mantenimiento_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "programaciones_mantenimiento";
CREATE SEQUENCE "ordenes_trabajo_id_seq" OWNED BY "ordenes_trabajo".id;
ALTER TABLE "ordenes_trabajo" ALTER COLUMN id SET DEFAULT nextval('ordenes_trabajo_id_seq');
SELECT setval('ordenes_trabajo_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "ordenes_trabajo";
CREATE SEQUENCE "intervenciones_id_seq" OWNED BY "intervenciones".id;
ALTER TABLE "intervenciones" ALTER COLUMN id SET DEFAULT nextval('intervenciones_id_seq');
SELECT setval('intervenciones_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "intervenciones";
CREATE SEQUENCE "actividades_orden_id_seq" OWNED BY "actividades_orden".id;
ALTER TABLE "actividades_orden" ALTER COLUMN id SET DEFAULT nextval('actividades_orden_id_seq');
SELECT setval('actividades_orden_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "actividades_orden";
CREATE SEQUENCE "orden_estado_historial_id_seq" OWNED BY "orden_estado_historial".id;
ALTER TABLE "orden_estado_historial" ALTER COLUMN id SET DEFAULT nextval('orden_estado_historial_id_seq');
SELECT setval('orden_estado_historial_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "orden_estado_historial";
CREATE SEQUENCE "orden_reasignaciones_id_seq" OWNED BY "orden_reasignaciones".id;
ALTER TABLE "orden_reasignaciones" ALTER COLUMN id SET DEFAULT nextval('orden_reasignaciones_id_seq');
SELECT setval('orden_reasignaciones_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "orden_reasignaciones";
CREATE SEQUENCE "repuestos_id_seq" OWNED BY "repuestos".id;
ALTER TABLE "repuestos" ALTER COLUMN id SET DEFAULT nextval('repuestos_id_seq');
SELECT setval('repuestos_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "repuestos";
CREATE SEQUENCE "consumos_repuesto_id_seq" OWNED BY "consumos_repuesto".id;
ALTER TABLE "consumos_repuesto" ALTER COLUMN id SET DEFAULT nextval('consumos_repuesto_id_seq');
SELECT setval('consumos_repuesto_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "consumos_repuesto";
CREATE SEQUENCE "autorizaciones_excepcion_consumo_id_seq" OWNED BY "autorizaciones_excepcion_consumo".id;
ALTER TABLE "autorizaciones_excepcion_consumo" ALTER COLUMN id SET DEFAULT nextval('autorizaciones_excepcion_consumo_id_seq');
SELECT setval('autorizaciones_excepcion_consumo_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "autorizaciones_excepcion_consumo";
CREATE SEQUENCE "movimientos_inventario_id_seq" OWNED BY "movimientos_inventario".id;
ALTER TABLE "movimientos_inventario" ALTER COLUMN id SET DEFAULT nextval('movimientos_inventario_id_seq');
SELECT setval('movimientos_inventario_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "movimientos_inventario";
CREATE SEQUENCE "modelos_bus_id_seq" OWNED BY "modelos_bus".id;
ALTER TABLE "modelos_bus" ALTER COLUMN id SET DEFAULT nextval('modelos_bus_id_seq');
SELECT setval('modelos_bus_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "modelos_bus";
CREATE SEQUENCE "rutas_id_seq" OWNED BY "rutas".id;
ALTER TABLE "rutas" ALTER COLUMN id SET DEFAULT nextval('rutas_id_seq');
SELECT setval('rutas_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "rutas";
CREATE SEQUENCE "jornadas_operativas_id_seq" OWNED BY "jornadas_operativas".id;
ALTER TABLE "jornadas_operativas" ALTER COLUMN id SET DEFAULT nextval('jornadas_operativas_id_seq');
SELECT setval('jornadas_operativas_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "jornadas_operativas";
CREATE SEQUENCE "planes_mantenimiento_preventivo_id_seq" OWNED BY "planes_mantenimiento_preventivo".id;
ALTER TABLE "planes_mantenimiento_preventivo" ALTER COLUMN id SET DEFAULT nextval('planes_mantenimiento_preventivo_id_seq');
SELECT setval('planes_mantenimiento_preventivo_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "planes_mantenimiento_preventivo";
CREATE SEQUENCE "compatibilidades_repuesto_id_seq" OWNED BY "compatibilidades_repuesto".id;
ALTER TABLE "compatibilidades_repuesto" ALTER COLUMN id SET DEFAULT nextval('compatibilidades_repuesto_id_seq');
SELECT setval('compatibilidades_repuesto_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "compatibilidades_repuesto";
CREATE SEQUENCE "alertas_internas_id_seq" OWNED BY "alertas_internas".id;
ALTER TABLE "alertas_internas" ALTER COLUMN id SET DEFAULT nextval('alertas_internas_id_seq');
SELECT setval('alertas_internas_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "alertas_internas";
CREATE SEQUENCE "alertas_destinatarios_id_seq" OWNED BY "alertas_destinatarios".id;
ALTER TABLE "alertas_destinatarios" ALTER COLUMN id SET DEFAULT nextval('alertas_destinatarios_id_seq');
SELECT setval('alertas_destinatarios_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "alertas_destinatarios";
CREATE SEQUENCE "eventos_auditoria_id_seq" OWNED BY "eventos_auditoria".id;
ALTER TABLE "eventos_auditoria" ALTER COLUMN id SET DEFAULT nextval('eventos_auditoria_id_seq');
SELECT setval('eventos_auditoria_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "eventos_auditoria";
CREATE SEQUENCE "solicitudes_idempotentes_id_seq" OWNED BY "solicitudes_idempotentes".id;
ALTER TABLE "solicitudes_idempotentes" ALTER COLUMN id SET DEFAULT nextval('solicitudes_idempotentes_id_seq');
SELECT setval('solicitudes_idempotentes_id_seq',COALESCE(max(id),1),max(id) IS NOT NULL) FROM "solicitudes_idempotentes";
-- Domain trigger functions only: UUID parameters/locals represent entity references.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT pg_get_functiondef(oid) AS definition FROM pg_proc
    WHERE pronamespace='public'::regnamespace AND (proname LIKE 'sgmv_%' OR proname IN
      ('fn_assert_consumo_repuesto_movimiento_unico','fn_assert_orden_cerrada_terminal',
       'fn_recalcular_costo_total_orden','fn_set_orden_costo_total_calculado','fn_trg_recalcular_costo_total_orden'))
  LOOP EXECUTE regexp_replace(r.definition,'\muuid\M','integer','gi'); END LOOP;
END $$;
DROP FUNCTION sgmv_obj_assert_jornada(uuid);
DROP FUNCTION sgmv_obj_assert_lectura(uuid);
DROP FUNCTION sgmv_obj_exigir_rol(uuid,text[]);
DROP FUNCTION fn_recalcular_costo_total_orden(uuid);
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM astra_fks LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',r.tbl,r.conname,r.definition);
  END LOOP;
END $$;
-- Cached HTTP responses and operation paths are invalid across the identifier contract.
DELETE FROM solicitudes_idempotentes;
-- Convert entity references inside whitelisted historical JSON and deduplication keys.
CREATE INDEX ON astra_id_map(old_id);
CREATE FUNCTION pg_temp.astra_references(p_text text) RETURNS text LANGUAGE plpgsql STRICT AS $$
DECLARE m record; result text := p_text;
BEGIN
 FOR m IN SELECT ids[1] AS old_id,min(new_id) AS new_id,count(DISTINCT new_id) AS alternatives
 FROM regexp_matches(p_text,'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}','g') AS ids
 JOIN astra_id_map ON old_id=ids[1]::uuid GROUP BY ids[1] LOOP
   IF m.alternatives > 1 THEN RAISE EXCEPTION 'Ambiguous historical entity reference: typed migration required'; END IF;
   result := replace(result, m.old_id::text, m.new_id::text);
 END LOOP;
 RETURN result;
END $$;
-- Rewrite only named domain references; technical UUIDs and free text are immutable.
CREATE FUNCTION pg_temp.astra_json_references(p_value jsonb) RETURNS jsonb LANGUAGE plpgsql STRICT AS $$
DECLARE entry record; result jsonb; target_table text; mapped integer; raw_value text;
BEGIN
 IF jsonb_typeof(p_value)='array' THEN
   SELECT coalesce(jsonb_agg(pg_temp.astra_json_references(value) ORDER BY ord),'[]'::jsonb)
     INTO result FROM jsonb_array_elements(p_value) WITH ORDINALITY a(value,ord);
   RETURN result;
 ELSIF jsonb_typeof(p_value)<>'object' THEN RETURN p_value;
 END IF;
 result := '{}'::jsonb;
 FOR entry IN SELECT key,value FROM jsonb_each(p_value) LOOP
   target_table := CASE entry.key
     WHEN 'busId' THEN 'buses' WHEN 'modeloBusId' THEN 'modelos_bus'
     WHEN 'rutaId' THEN 'rutas' WHEN 'jornadaId' THEN 'jornadas_operativas'
     WHEN 'jornadaOperativaId' THEN 'jornadas_operativas'
     WHEN 'novedadId' THEN 'novedades' WHEN 'ordenTrabajoId' THEN 'ordenes_trabajo'
     WHEN 'repuestoId' THEN 'repuestos' WHEN 'planId' THEN 'planes_mantenimiento_preventivo'
     WHEN 'reglaId' THEN 'compatibilidades_repuesto'
     WHEN 'programacionMantenimientoId' THEN 'programaciones_mantenimiento'
     WHEN 'conductorId' THEN 'usuarios' WHEN 'usuarioId' THEN 'usuarios'
     WHEN 'actorId' THEN 'usuarios' WHEN 'tecnicoAsignadoId' THEN 'usuarios'
     ELSE NULL END;
   raw_value := entry.value #>> '{}';
   IF target_table IS NOT NULL AND jsonb_typeof(entry.value)='string'
      AND raw_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
     SELECT new_id INTO mapped FROM astra_id_map WHERE table_name=target_table AND old_id=raw_value::uuid;
     -- A deleted historical entity has no replacement; retain its historical identifier.
     result := result || jsonb_build_object(entry.key,COALESCE(to_jsonb(mapped),entry.value));
   ELSE result := result || jsonb_build_object(entry.key,pg_temp.astra_json_references(entry.value));
   END IF;
 END LOOP;
 RETURN result;
END $$;
UPDATE alertas_internas SET contexto_evento=pg_temp.astra_json_references(contexto_evento),
 clave_deduplicacion=CASE
   WHEN clave_deduplicacion LIKE 'consumo-incompatible:%' THEN clave_deduplicacion
   WHEN clave_deduplicacion LIKE 'conflicto-jornada:bus:%:solicitud:%' THEN
     pg_temp.astra_references(split_part(clave_deduplicacion,':solicitud:',1)) || ':solicitud:' || split_part(clave_deduplicacion,':solicitud:',2)
   ELSE pg_temp.astra_references(clave_deduplicacion) END;
UPDATE ordenes_trabajo SET plan_aplicado=pg_temp.astra_json_references(plan_aplicado) WHERE plan_aplicado IS NOT NULL;
UPDATE consumos_repuesto SET evidencia_compatibilidad=pg_temp.astra_json_references(evidencia_compatibilidad) WHERE evidencia_compatibilidad IS NOT NULL;
-- Original HTTP route/requestId are historical evidence, not rewritten requests.
UPDATE eventos_auditoria SET recurso_id=pg_temp.astra_references(recurso_id),detalles=pg_temp.astra_json_references(detalles);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM astra_checks LOOP EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',r.tbl,r.conname,r.definition); END LOOP;
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM astra_triggers LOOP
  EXECUTE r.definition;
  IF r.tgenabled='D' THEN EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I',r.tbl,r.tgname); END IF;
 END LOOP;
END $$;
COMMIT;
