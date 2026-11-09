BEGIN;
SET LOCAL search_path=public,pg_catalog;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE correction_preserved(tab text,id integer,digest text);
CREATE TEMP TABLE correction_events(kind text,id integer,detail jsonb);
CREATE FUNCTION pg_temp.transition(oid integer,target estado_orden_trabajo,a integer,t timestamptz,note text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE oldstate estado_orden_trabajo;
BEGIN
 SELECT estado INTO STRICT oldstate FROM ordenes_trabajo WHERE id=oid FOR UPDATE;
 INSERT INTO orden_estado_historial(orden_trabajo_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,observacion) VALUES(oid,oldstate,target,a,t,note);
 UPDATE ordenes_trabajo SET estado=target,updated_at=t WHERE id=oid;
END $$;
CREATE FUNCTION pg_temp.reading(b integer,j integer,o integer,i integer,a integer,t timestamptz,kind tipo_lectura,km integer,note text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE oldkm integer;
BEGIN
 SELECT kilometraje_actual INTO STRICT oldkm FROM buses WHERE id=b FOR UPDATE;
 IF km<oldkm THEN RAISE EXCEPTION 'Retroceso de kilometraje'; END IF;
 INSERT INTO lecturas_kilometraje(bus_id,kilometraje_anterior,kilometraje_nuevo,registrado_por_id,observado_por_id,fecha_registro,fecha_lectura,motivo,tipo,jornada_operativa_id,orden_trabajo_id,intervencion_id)
 VALUES(b,oldkm,km,a,a,clock_timestamp(),t,note,kind,j,o,i);
 UPDATE buses SET kilometraje_actual=km,updated_at=clock_timestamp() WHERE id=b;
END $$;
CREATE FUNCTION pg_temp.bus_state(b integer,target estado_bus,t timestamptz,note text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE oldstate estado_bus;
BEGIN
 SELECT estado_operativo INTO STRICT oldstate FROM buses WHERE id=b FOR UPDATE;
 IF oldstate<>target THEN
  INSERT INTO bus_estado_historial(bus_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,motivo) VALUES(b,oldstate,target,122,t,note);
  UPDATE buses SET estado_operativo=target,updated_at=clock_timestamp() WHERE id=b;
 END IF;
END $$;
CREATE FUNCTION pg_temp.finish_order(oid integer,t timestamptz,note text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE ord ordenes_trabajo%ROWTYPE; iid integer; km integer; tech integer; schedule programaciones_mantenimiento%ROWTYPE; planrow planes_mantenimiento_preventivo%ROWTYPE;
BEGIN
 SELECT * INTO STRICT ord FROM ordenes_trabajo WHERE id=oid FOR UPDATE;
 IF ord.estado NOT IN ('PENDIENTE_ASIGNACION','ASIGNADA','EN_EJECUCION','COMPLETADA_TECNICO') THEN RAISE EXCEPTION 'Estado inesperado %',oid; END IF;
 tech:=COALESCE(ord.tecnico_asignado_id,20);
 IF EXISTS(SELECT 1 FROM jornadas_operativas WHERE bus_id=ord.bus_id AND estado='EN_CURSO') THEN RAISE EXCEPTION 'Taller con jornada activa %',oid; END IF;
 IF ord.estado='PENDIENTE_ASIGNACION' THEN
  INSERT INTO orden_estado_historial(orden_trabajo_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,observacion) VALUES(oid,'PENDIENTE_ASIGNACION','ASIGNADA',122,t,note||': asignación');
  UPDATE ordenes_trabajo SET estado='ASIGNADA',tecnico_asignado_id=tech,fecha_asignacion=t,updated_at=clock_timestamp() WHERE id=oid;
  ord.estado:='ASIGNADA';
 END IF;
 IF ord.estado='ASIGNADA' THEN
  UPDATE ordenes_trabajo SET fecha_inicio_ejecucion=t+interval '1 minute' WHERE id=oid;
  PERFORM pg_temp.transition(oid,'EN_EJECUCION',tech,t+interval '1 minute',note||': inicio de inspección');
  INSERT INTO intervenciones(orden_trabajo_id,tecnico_id,fecha_inicio,diagnostico,observaciones,created_at,updated_at)
  VALUES(oid,tech,t+interval '1 minute',note||': inspección funcional y corrección académica; no certificación empresarial',note,t+interval '1 minute',t+interval '1 minute') RETURNING id INTO iid;
  SELECT kilometraje_actual INTO km FROM buses WHERE id=ord.bus_id;
  PERFORM pg_temp.reading(ord.bus_id,NULL,oid,iid,tech,t+interval '1 minute','INGRESO_TALLER',km,note);
  PERFORM pg_temp.bus_state(ord.bus_id,'EN_MANTENIMIENTO',t+interval '1 minute',note);
 ELSE
  SELECT id INTO STRICT iid FROM intervenciones WHERE orden_trabajo_id=oid ORDER BY fecha_inicio DESC,id DESC LIMIT 1;
 END IF;
 IF ord.estado<>'COMPLETADA_TECNICO' THEN
  UPDATE ordenes_trabajo SET espera_tipo=NULL,espera_motivo=NULL,espera_desde=NULL,espera_registrada_por_id=NULL WHERE id=oid;
  INSERT INTO actividades_orden(intervencion_id,descripcion,fecha_registro,registrada_por_id) VALUES(iid,note||': comprobación funcional, ajuste y revisión final simulados',t+interval '10 minutes',tech);
  UPDATE intervenciones SET diagnostico=COALESCE(NULLIF(diagnostico,''),note||': diagnóstico académico de continuidad'),fecha_fin=t+interval '20 minutes',updated_at=clock_timestamp() WHERE id=iid;
  UPDATE ordenes_trabajo SET fecha_completada_tecnico=t+interval '20 minutes' WHERE id=oid;
  PERFORM pg_temp.transition(oid,'COMPLETADA_TECNICO',tech,t+interval '20 minutes',note||': prueba funcional completada');
 END IF;
 SELECT kilometraje_actual INTO km FROM buses WHERE id=ord.bus_id;
 IF NOT EXISTS(SELECT 1 FROM lecturas_kilometraje WHERE orden_trabajo_id=oid AND tipo='CIERRE_MANTENIMIENTO') THEN
  PERFORM pg_temp.reading(ord.bus_id,NULL,oid,iid,tech,t+interval '21 minutes','CIERRE_MANTENIMIENTO',km,note);
 END IF;
 UPDATE ordenes_trabajo SET fecha_cierre=t+interval '22 minutes',cerrada_por_id=122,disponibilidad_al_cierre=true WHERE id=oid;
 PERFORM pg_temp.transition(oid,'CERRADA',122,t+interval '22 minutes',note||': validación administrativa simulada');
 IF ord.programacion_mantenimiento_id IS NOT NULL THEN
  SELECT * INTO STRICT schedule FROM programaciones_mantenimiento WHERE id=ord.programacion_mantenimiento_id;
  UPDATE programaciones_mantenimiento SET activa=false,updated_at=clock_timestamp() WHERE id=ord.programacion_mantenimiento_id;
  IF schedule.plan_mantenimiento_preventivo_id IS NOT NULL THEN
   SELECT * INTO STRICT planrow FROM planes_mantenimiento_preventivo WHERE id=schedule.plan_mantenimiento_preventivo_id;
   INSERT INTO programaciones_mantenimiento(bus_id,tipo,actividad,criterio,fecha_programada,kilometraje_objetivo,activa,creada_por_id,created_at,updated_at,plan_mantenimiento_preventivo_id,prioridad)
   VALUES(ord.bus_id,schedule.tipo,schedule.actividad,schedule.criterio,CASE WHEN planrow.intervalo_dias IS NOT NULL THEN schedule.fecha_programada+planrow.intervalo_dias END,CASE WHEN planrow.intervalo_km IS NOT NULL THEN schedule.kilometraje_objetivo+planrow.intervalo_km END,true,122,clock_timestamp(),clock_timestamp(),planrow.id,schedule.prioridad);
  END IF;
 END IF;
 PERFORM pg_temp.bus_state(ord.bus_id,'OPERATIVO',t+interval '22 minutes',note||': retorno a disponibilidad');
 INSERT INTO correction_events VALUES('ORDER_CLOSED',oid,jsonb_build_object('bus',ord.bus_id,'previousState',ord.estado));
END $$;
DO $$
DECLARE rec record; oldjson jsonb; newid integer; oid integer; note text:='SIMULADO_SGMV · regularización integral 2026-11-09'; atime timestamptz:='2026-11-09 13:30:00-05';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('sgmv:regularizacion-integral:2026-11-09',0));
 IF EXISTS(SELECT 1 FROM eventos_auditoria WHERE request_id='cc261109-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Corrección ya aplicada'; END IF;
 IF atime+interval '122 minutes'>clock_timestamp() THEN RAISE EXCEPTION 'No se permite ejecutar actividad futura'; END IF;
 PERFORM 1 FROM buses ORDER BY id FOR UPDATE;
 /*EXPECTED_SOURCE_CHECKS*/
 INSERT INTO correction_preserved
 SELECT 'usuarios',id,md5((to_jsonb(x)-'ultimo_acceso_at'-'updated_at')::text) FROM usuarios x UNION ALL
 SELECT 'rutas',id,md5(to_jsonb(x)::text) FROM rutas x UNION ALL
 SELECT 'planes_mantenimiento_preventivo',id,md5(to_jsonb(x)::text) FROM planes_mantenimiento_preventivo x UNION ALL
 SELECT 'evidencias_novedad',id,md5(to_jsonb(x)::text) FROM evidencias_novedad x UNION ALL
 SELECT 'lecturas_kilometraje',id,md5(to_jsonb(x)::text) FROM lecturas_kilometraje x UNION ALL
 SELECT 'ordenes_trabajo',id,md5(to_jsonb(x)::text) FROM ordenes_trabajo x WHERE estado IN('CERRADA','ANULADA') UNION ALL
 SELECT 'jornadas_operativas',id,md5(to_jsonb(x)::text) FROM jornadas_operativas x WHERE id NOT IN(1,1017,1021) UNION ALL
 SELECT 'consumos_repuesto',id,md5(to_jsonb(x)::text) FROM consumos_repuesto x UNION ALL
 SELECT 'eventos_auditoria',id,md5(to_jsonb(x)::text) FROM eventos_auditoria x;

 -- Preserve historical identities. Unstarted old validation trips are cancelled, not invented.
 UPDATE jornadas_operativas SET estado='CANCELADA',cambio_por_id=122,fecha_cambio=atime,motivo_cambio=note||': programación histórica de validación sin salida registrada; no se atribuye operación real',updated_at=clock_timestamp() WHERE id IN(1017,1021) AND estado='PROGRAMADA';
 UPDATE jornadas_operativas SET estado='FINALIZADA',fin_real='2026-09-14 18:15:00-05',finalizada_por_id=122,updated_at=clock_timestamp() WHERE id=1 AND estado='EN_CURSO';
 PERFORM pg_temp.reading(108,1,NULL,NULL,122,'2026-09-14 18:15:00-05','FIN_JORNADA',(SELECT kilometraje_actual+290 FROM buses WHERE id=108),note||': cierre retrospectivo simulado del trayecto de demostración; 290 km proyectados, no lectura empresarial');

 -- Reconcile an inherited 200-km gap without rewriting either original reading.
 IF NOT EXISTS(SELECT 1 FROM lecturas_kilometraje WHERE id=1022 AND bus_id=21 AND kilometraje_anterior=45200 AND kilometraje_nuevo=45200 AND fecha_lectura='2026-09-02 07:00:01-05') THEN RAISE EXCEPTION 'La lectura histórica a conciliar cambió'; END IF;
 INSERT INTO lecturas_kilometraje(bus_id,kilometraje_anterior,kilometraje_nuevo,registrado_por_id,observado_por_id,fecha_registro,fecha_lectura,motivo,tipo)
 VALUES(21,45000,45200,122,122,clock_timestamp(),'2026-09-02 06:59:59-05',note||': conciliación administrativa simulada del salto histórico 45000→45200 ya contenido en los registros de prueba. No constituye recorrido ni odómetro empresarial observado. Se conservan las lecturas originales.','AJUSTE_ADMINISTRATIVO');
 INSERT INTO correction_events VALUES('HISTORICAL_MILEAGE_RECONCILED',21,jsonb_build_object('from',45000,'to',45200,'originalNextReading',1022));

 -- Validation fixtures are explicitly retired, never silently deleted or called executed.
 FOR rec IN SELECT * FROM ordenes_trabajo WHERE id IN(55,76) LOOP
  INSERT INTO orden_estado_historial(orden_trabajo_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,observacion) VALUES(rec.id,rec.estado,'ANULADA',122,atime,note||': archivo trazable de validación');
  UPDATE ordenes_trabajo SET estado='ANULADA',fecha_anulacion=atime,anulada_por_id=122,motivo_anulacion=note||': archivo de caso de validación sin ejecución técnica; conserva origen e historial',updated_at=clock_timestamp() WHERE id=rec.id;
  INSERT INTO correction_events VALUES('VALIDATION_ORDER_ARCHIVED',rec.id,to_jsonb(rec));
 END LOOP;
 FOR rec IN SELECT * FROM programaciones_mantenimiento WHERE tipo LIKE 'Cierre visual RF03 %' OR bus_id=60 LOOP
  UPDATE programaciones_mantenimiento SET activa=false,updated_at=clock_timestamp() WHERE id=rec.id;
  INSERT INTO correction_events VALUES('VALIDATION_SCHEDULE_ARCHIVED',rec.id,to_jsonb(rec));
 END LOOP;
 UPDATE asignaciones_conductor SET activa=false,fecha_fin=atime,updated_at=clock_timestamp() WHERE bus_id=60 AND activa;
 PERFORM pg_temp.bus_state(41,'INACTIVO',atime,note||': vehículo de validación archivado; historial conservado');
 PERFORM pg_temp.bus_state(60,'INACTIVO',atime,note||': vehículo de validación archivado; historial conservado');

 PERFORM pg_temp.finish_order(36,atime,note||': continuación autorizada del preventivo antiguo, sin alterar su creación ni asignación');
 PERFORM pg_temp.finish_order(6,atime+interval '25 minutes',note||': atención de novedad antigua de la demo');
 PERFORM pg_temp.finish_order(158,atime,note||': resolución UNITRANSA');
 PERFORM pg_temp.finish_order(159,atime,note||': resolución TRANSCOLOMBIA');
 PERFORM pg_temp.finish_order(160,atime,note||': validación COTRANDER');

 INSERT INTO ordenes_trabajo(codigo,bus_id,tipo,origen,prioridad,descripcion,estado,creada_por_id,fecha_creacion,programacion_mantenimiento_id,fecha_objetivo_preventivo,kilometraje_objetivo_preventivo,created_at,updated_at)
 SELECT 'SIM261109-R-P-21',bus_id,'PREVENTIVA','PREVENTIVO','MEDIA',note||': atención del cambio de aceite pendiente','PENDIENTE_ASIGNACION',122,atime+interval '50 minutes',id,fecha_programada,kilometraje_objetivo,clock_timestamp(),clock_timestamp() FROM programaciones_mantenimiento WHERE id=1031 AND activa RETURNING id INTO STRICT oid;
 PERFORM pg_temp.finish_order(oid,atime+interval '50 minutes',note||': cambio de lubricante y revisión simulados, sin consumo ficticio de inventario');
 -- A second demonstrator had an old maintenance flag without an active order.
 INSERT INTO ordenes_trabajo(codigo,bus_id,tipo,origen,prioridad,descripcion,estado,creada_por_id,fecha_creacion,created_at,updated_at)
 VALUES('SIM261109-R-C-22',22,'CORRECTIVA','CORRECTIVO_DIRECTO','BAJA',note||': revisión funcional antes del retorno a servicio','PENDIENTE_ASIGNACION',122,atime+interval '75 minutes',clock_timestamp(),clock_timestamp()) RETURNING id INTO oid;
 PERFORM pg_temp.finish_order(oid,atime+interval '75 minutes',note||': comprobación académica sin repuestos, no certificación mecánica real');

 -- The legacy demonstrator is ten kilometres from its target after the reconciled trip.
 INSERT INTO ordenes_trabajo(codigo,bus_id,tipo,origen,prioridad,descripcion,estado,creada_por_id,fecha_creacion,programacion_mantenimiento_id,fecha_objetivo_preventivo,kilometraje_objetivo_preventivo,plan_aplicado,created_at,updated_at)
 SELECT 'SIM261109-R-P-108',s.bus_id,'PREVENTIVA','PREVENTIVO','MEDIA',note||': inspección y servicio preventivo académico por kilometraje próximo','PENDIENTE_ASIGNACION',122,atime+interval '100 minutes',s.id,s.fecha_programada,s.kilometraje_objetivo,
 jsonb_build_object('schemaVersion',1,'busId',s.bus_id,'planId',p.id,'planVersion',p.version,'claveTarea',p.clave_tarea,'actividad',p.actividad,'componente',p.componente,'criterio',p.criterio,'prioridad',p.prioridad,'origenRegla',p.origen_regla,'referenciaRegla',p.referencia_regla,'intervaloDias',p.intervalo_dias,'intervaloKm',p.intervalo_km,'bloqueaAlVencer',p.bloquea_al_vencer,'anticipacionDiasEfectiva',COALESCE(p.anticipacion_dias,7),'anticipacionKmEfectiva',COALESCE(p.anticipacion_km,500),'destinoAplicado',jsonb_build_object('tipo','BUS','busId',s.bus_id),'origenPlan','BUS','fechaObjetivo',s.fecha_programada::text,'kilometrajeObjetivo',s.kilometraje_objetivo,'programacionId',s.id,'materializadoAt',s.created_at),clock_timestamp(),clock_timestamp()
 FROM programaciones_mantenimiento s JOIN planes_mantenimiento_preventivo p ON p.id=s.plan_mantenimiento_preventivo_id WHERE s.id=21 AND s.activa RETURNING id INTO STRICT oid;
 PERFORM pg_temp.finish_order(oid,atime+interval '100 minutes',note||': ciclo por kilometraje atendido; siguiente objetivo desde el objetivo anterior, sin salto de cadencia');

 UPDATE novedades SET estado='RESUELTA_SIN_ORDEN',revisada_por_id=122,fecha_revision=atime+interval '30 minutes',observacion_revision=note||': revisión y fijación de elemento menor simuladas',clasificacion='Observación menor resuelta',criticidad='BAJA',afecta_operacion=false,bloquea_disponibilidad=false,respuesta_operativa=note||': no requiere taller; continuidad autorizada',updated_at=clock_timestamp() WHERE estado='PENDIENTE_REVISION' AND bus_id=115;

 -- Reference assignments coexist with explicit AM/PM journey drivers; one active base per bus/driver.
 FOR rec IN SELECT b.id bus_id,u.id conductor_id FROM buses b JOIN usuarios u ON u.email='conductor.'||lower(split_part(b.codigo_interno,'-',2))||CASE WHEN b.id%2=1 THEN '.am.demo@sgmv.local' ELSE '.pm.demo@sgmv.local' END WHERE b.id BETWEEN 109 AND 130 ORDER BY b.id LOOP
  INSERT INTO asignaciones_conductor(bus_id,conductor_id,fecha_inicio,activa,asignado_por_id,motivo,created_at,updated_at) VALUES(rec.bus_id,rec.conductor_id,'2026-10-15 00:00:00-05',true,122,note||': asignación base principal/reserva. El turno y bus efectivamente operado se conservan por jornada.',clock_timestamp(),clock_timestamp());
 END LOOP;
 INSERT INTO asignaciones_conductor(bus_id,conductor_id,fecha_inicio,activa,asignado_por_id,motivo,updated_at) VALUES(108,120,atime,true,122,note||': conductor de referencia del demostrador',clock_timestamp());
 INSERT INTO usuarios(nombre,email,estado,rol_id,contrasena_hash,updated_at) SELECT 'Conductor de reserva BUS-002 · Simulado','conductor.reserva.bus002.demo@sgmv.local','ACTIVO',id,/*NEW_RANDOM_HASH*/,clock_timestamp() FROM roles WHERE codigo='CONDUCTOR' RETURNING id INTO newid;
 INSERT INTO asignaciones_conductor(bus_id,conductor_id,fecha_inicio,activa,asignado_por_id,motivo,updated_at) VALUES(22,newid,atime+interval '97 minutes',true,122,note||': conductor de referencia de reserva; clave aleatoria no distribuida, cuentas existentes intactas',clock_timestamp());

 -- Replenishment is a labelled demo movement, never a stock reset or alleged purchase.
 FOR rec IN SELECT * FROM repuestos WHERE estado='ACTIVO' AND stock_actual<=stock_minimo LOOP
  INSERT INTO movimientos_inventario(repuesto_id,tipo,cantidad,costo_unitario,motivo,responsable_id,clave_idempotencia) VALUES(rec.id,'ENTRADA',rec.stock_minimo-rec.stock_actual+2,rec.costo_unitario,note||': reposición académica para regularizar disponibilidad; no compra real',122,gen_random_uuid());
  UPDATE repuestos SET stock_actual=stock_minimo+2,updated_at=clock_timestamp() WHERE id=rec.id;
  INSERT INTO correction_events VALUES('DEMO_RESTOCK',rec.id,jsonb_build_object('previousStock',rec.stock_actual,'newStock',rec.stock_minimo+2));
 END LOOP;

 UPDATE alertas_destinatarios ad SET estado='ATENDIDA',fecha_lectura=COALESCE(ad.fecha_lectura,GREATEST(ai.fecha_generacion,clock_timestamp())),fecha_atencion=GREATEST(ai.fecha_generacion,clock_timestamp()),updated_at=clock_timestamp() FROM alertas_internas ai WHERE ad.alerta_interna_id=ai.id AND ad.estado<>'ATENDIDA' AND (
  EXISTS(SELECT 1 FROM ordenes_trabajo o WHERE o.id=ai.orden_trabajo_id AND o.estado IN('CERRADA','ANULADA')) OR
  EXISTS(SELECT 1 FROM programaciones_mantenimiento s WHERE s.id=ai.programacion_mantenimiento_id AND NOT s.activa) OR
  EXISTS(SELECT 1 FROM jornadas_operativas j WHERE j.id=ai.jornada_operativa_id AND j.estado IN('FINALIZADA','CANCELADA','REASIGNADA')) OR
  EXISTS(SELECT 1 FROM novedades n WHERE n.id=ai.novedad_id AND n.estado='RESUELTA_SIN_ORDEN') OR
  EXISTS(SELECT 1 FROM buses b WHERE b.id=ai.bus_id AND b.estado_operativo='INACTIVO') OR
  EXISTS(SELECT 1 FROM repuestos r WHERE r.id=ai.repuesto_id AND r.stock_actual>r.stock_minimo));
 FOR rec IN SELECT * FROM correction_preserved LOOP
  EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=$1',rec.tab) INTO oldjson USING rec.id;
  IF rec.tab='usuarios' THEN oldjson:=oldjson-'ultimo_acceso_at'-'updated_at'; END IF;
  IF md5(oldjson::text) IS DISTINCT FROM rec.digest THEN RAISE EXCEPTION 'Historia protegida alterada % %',rec.tab,rec.id; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM buses b WHERE estado_operativo<>'INACTIVO' AND NOT EXISTS(SELECT 1 FROM asignaciones_conductor a JOIN usuarios u ON u.id=a.conductor_id WHERE a.bus_id=b.id AND a.activa AND u.estado='ACTIVO')) THEN RAISE EXCEPTION 'Falta conductor activo'; END IF;
 IF EXISTS(SELECT 1 FROM ordenes_trabajo WHERE estado NOT IN('CERRADA','ANULADA')) THEN RAISE EXCEPTION 'Persisten órdenes sin resolver'; END IF;
 IF EXISTS(SELECT 1 FROM jornadas_operativas WHERE estado='PROGRAMADA' AND fin_programado<clock_timestamp()) THEN RAISE EXCEPTION 'Persisten jornadas antiguas sin resolver'; END IF;
 INSERT INTO eventos_auditoria(request_id,actor_id,metodo,ruta,accion,recurso_tipo,recurso_id,resultado,status_http,detalles,fecha_evento)
 VALUES('cc261109-0000-4000-8000-000000000002',122,'POST','/maintenance/demo-regularizacion','DEMO_REGULARIZACION_COMPLETA','SIMULADO_SGMV','2026-11-09','EXITO',200,jsonb_build_object('origen','SIMULADO_SGMV','metodoReal','SQL controlado, no HTTP','importedAt',clock_timestamp(),'cutoff',atime+interval '122 minutes','events',(SELECT jsonb_agg(to_jsonb(e)) FROM correction_events e),'scope','Global: sin borrar historia, ni ejecutar jornadas futuras, ni alterar credenciales existentes'),clock_timestamp());
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
CREATE TEMP TABLE correction_validation AS /*GLOBAL_VERIFY_QUERY*/;
DO $$
DECLARE checks jsonb;
BEGIN
 SELECT json_build_object::jsonb INTO checks FROM correction_validation;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(checks) WHERE value::integer<>0) THEN RAISE EXCEPTION 'Fallo de coherencia global: %',checks; END IF;
END $$;
SELECT json_build_object('assignments',(SELECT count(*) FROM asignaciones_conductor WHERE activa),'activeBuses',(SELECT count(*) FROM buses WHERE estado_operativo<>'INACTIVO'),'openOrders',(SELECT count(*) FROM ordenes_trabajo WHERE estado NOT IN('CERRADA','ANULADA')),'activeSchedules',(SELECT count(*) FROM programaciones_mantenimiento WHERE activa),'events',(SELECT json_agg(e) FROM correction_events e));
COMMIT;
