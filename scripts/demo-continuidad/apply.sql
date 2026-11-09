BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SET LOCAL search_path=public,pg_catalog;
CREATE TEMP TABLE demo_input AS SELECT /*PLAN_JSON*/ AS plan;
CREATE TEMP TABLE demo_refs(key text PRIMARY KEY,id integer,aux integer,start_km integer,data jsonb);
CREATE TEMP TABLE demo_preserved(tab text,id integer,digest text,PRIMARY KEY(tab,id));

-- These helpers are transaction-local: no schema or runtime code is deployed.
CREATE FUNCTION pg_temp.ref(k text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 IF k IS NULL THEN RETURN NULL; END IF;
 IF k ~ '^[0-9]+$' THEN RETURN k::integer; END IF;
 SELECT id INTO n FROM demo_refs WHERE key=k;
 IF n IS NULL THEN RAISE EXCEPTION 'Referencia de simulación no encontrada: %',k; END IF;
 RETURN n;
END $$;

CREATE FUNCTION pg_temp.reading(b integer,j integer,o integer,i integer,a integer,t timestamptz,kind tipo_lectura,km integer,note text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE oldkm integer; rid integer;
BEGIN
 SELECT kilometraje_actual INTO STRICT oldkm FROM buses WHERE id=b FOR UPDATE;
 IF km<oldkm THEN RAISE EXCEPTION 'El odómetro retrocedería para bus %',b; END IF;
 INSERT INTO lecturas_kilometraje(bus_id,kilometraje_anterior,kilometraje_nuevo,registrado_por_id,observado_por_id,fecha_registro,fecha_lectura,motivo,tipo,jornada_operativa_id,orden_trabajo_id,intervencion_id)
 VALUES(b,oldkm,km,a,a,clock_timestamp(),t,note,kind,j,o,i) RETURNING id INTO rid;
 UPDATE buses SET kilometraje_actual=km,updated_at=t WHERE id=b;
 RETURN rid;
END $$;

CREATE FUNCTION pg_temp.transition(oid integer,target estado_orden_trabajo,a integer,t timestamptz,note text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE oldstate estado_orden_trabajo;
BEGIN
 SELECT estado INTO STRICT oldstate FROM ordenes_trabajo WHERE id=oid FOR UPDATE;
 IF oldstate=target THEN RETURN; END IF;
 INSERT INTO orden_estado_historial(orden_trabajo_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,observacion)
 VALUES(oid,oldstate,target,a,t,note);
 UPDATE ordenes_trabajo SET estado=target,updated_at=t WHERE id=oid;
END $$;

DO $$
DECLARE p jsonb; e jsonb; d jsonb; t timestamptz; oid integer; iid integer; jid integer; nid integer; rid integer; mid integer; sid integer; cid integer; aid integer;
 b integer; actor integer; km integer; qty numeric; cost numeric; tech integer; k text; note text; oldstate estado_bus; schedule programaciones_mantenimiento%ROWTYPE; planrow planes_mantenimiento_preventivo%ROWTYPE;
 rec record; oldjson jsonb; newjson jsonb; model integer;
BEGIN
 SELECT plan INTO p FROM demo_input;
 PERFORM pg_advisory_xact_lock(hashtextextended('sgmv:demo-continuidad:2026-11-09',0));
 IF EXISTS(SELECT 1 FROM eventos_auditoria WHERE request_id=(p->>'runId')::uuid AND accion='DEMO_CONTINUIDAD_COMPLETA') THEN RAISE EXCEPTION 'Lote ya aplicado'; END IF;
 IF (p->>'cutoff')::timestamptz>clock_timestamp() THEN RAISE EXCEPTION 'Corte futuro'; END IF;
 PERFORM 1 FROM buses WHERE id IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds')) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM repuestos WHERE codigo LIKE 'SIM-AMB-REP-%' ORDER BY id FOR UPDATE;
 FOR oldjson IN SELECT value FROM jsonb_array_elements(p->'sourceBuses') LOOP
  SELECT to_jsonb(x) INTO newjson FROM buses x WHERE id=(oldjson->>'id')::integer;
  IF oldjson<>newjson THEN RAISE EXCEPTION 'Bus cambió después del inventario: %',oldjson->>'id'; END IF;
 END LOOP;
 FOR oldjson IN SELECT value FROM jsonb_array_elements(p->'sourceJourneys') LOOP
  SELECT to_jsonb(x) INTO newjson FROM jornadas_operativas x WHERE id=(oldjson->>'id')::integer;
  IF oldjson<>newjson THEN RAISE EXCEPTION 'Jornada cambió después del inventario: %',oldjson->>'id'; END IF;
 END LOOP;
 INSERT INTO demo_preserved
 SELECT 'usuarios',id,md5(to_jsonb(x)::text) FROM usuarios x UNION ALL
 SELECT 'rutas',id,md5(to_jsonb(x)::text) FROM rutas x UNION ALL
 SELECT 'planes_mantenimiento_preventivo',id,md5(to_jsonb(x)::text) FROM planes_mantenimiento_preventivo x UNION ALL
 SELECT 'evidencias_novedad',id,md5(to_jsonb(x)::text) FROM evidencias_novedad x UNION ALL
 SELECT 'lecturas_kilometraje',id,md5(to_jsonb(x)::text) FROM lecturas_kilometraje x UNION ALL
 SELECT 'novedades',id,md5(to_jsonb(x)::text) FROM novedades x UNION ALL
 SELECT 'eventos_auditoria',id,md5(to_jsonb(x)::text) FROM eventos_auditoria x UNION ALL
 SELECT 'buses',id,md5(to_jsonb(x)::text) FROM buses x WHERE id NOT IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds')) UNION ALL
 SELECT 'jornadas_operativas',id,md5(to_jsonb(x)::text) FROM jornadas_operativas x WHERE bus_id NOT IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds')) OR inicio_programado>(p->>'cutoff')::timestamptz UNION ALL
 SELECT 'ordenes_trabajo',id,md5(to_jsonb(x)::text) FROM ordenes_trabajo x WHERE bus_id NOT IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds')) UNION ALL
 SELECT 'programaciones_mantenimiento',id,md5(to_jsonb(x)::text) FROM programaciones_mantenimiento x WHERE bus_id NOT IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds')) UNION ALL
 SELECT 'repuestos',id,md5(to_jsonb(x)::text) FROM repuestos x WHERE codigo NOT LIKE 'SIM-AMB-REP-%';
 note:=p->>'marker';
 -- Add explicit academic compatibility only when no effective rule exists.
 SELECT modelo_bus_id INTO STRICT model FROM buses WHERE id=(p->'busIds'->>0)::integer;
 FOR rec IN SELECT * FROM repuestos WHERE codigo LIKE 'SIM-AMB-REP-%' ORDER BY id LOOP
  IF NOT EXISTS(SELECT 1 FROM compatibilidades_repuesto WHERE repuesto_id=rec.id AND vigente) THEN
   INSERT INTO compatibilidades_repuesto(repuesto_id,modelo_bus_id,version,permitido,condicion_uso,especificaciones_validadas,vigente,fecha_definicion,definida_por_id,created_at,updated_at)
   VALUES(rec.id,model,1,true,note||': exclusivamente modelo académico; no certificación de fabricante',jsonb_build_object('origen','SIMULADO_SGMV','contexto',note),true,'2026-10-15 00:00:00-05',(p->>'admin')::integer,'2026-10-15 00:00:00-05','2026-10-15 00:00:00-05');
  END IF;
 END LOOP;

 FOR e IN SELECT value FROM jsonb_array_elements(p->'events') LOOP
  d:=e->'payload';t:=(e->>'time')::timestamptz;k:=d->>'key';b:=(d->>'busId')::integer;actor:=(d->>'actor')::integer;
  IF t>(p->>'cutoff')::timestamptz THEN RAISE EXCEPTION 'Evento futuro'; END IF;
  CASE e->>'kind'
  WHEN 'REASSIGN' THEN
   jid:=(d->>'id')::integer;
   UPDATE jornadas_operativas SET estado='REASIGNADA',cambio_por_id=actor,fecha_cambio=t,motivo_cambio=d->>'reason',updated_at=t WHERE id=jid AND estado='PROGRAMADA';
   IF NOT FOUND THEN RAISE EXCEPTION 'No se puede sustituir jornada %',jid; END IF;
   INSERT INTO jornadas_operativas(bus_id,conductor_id,ruta_id,estado,inicio_programado,fin_programado,programada_por_id,jornada_anterior_id,motivo_sucesion,ciclos_completos_simulados,km_no_comerciales_simulados,longitud_km_oficial_snapshot,km_proyectados_demo,created_at,updated_at)
   SELECT b,conductor_id,ruta_id,'PROGRAMADA',inicio_programado,fin_programado,actor,id,d->>'reason',ciclos_completos_simulados,km_no_comerciales_simulados,longitud_km_oficial_snapshot,km_proyectados_demo,t,t FROM jornadas_operativas WHERE id=jid RETURNING id INTO rid;
   INSERT INTO demo_refs(key,id,data) VALUES(k,rid,d);
  WHEN 'JOURNEY_START' THEN
   jid:=pg_temp.ref(k);
   IF EXISTS(SELECT 1 FROM ordenes_trabajo WHERE bus_id=b AND estado NOT IN('CERRADA','ANULADA')) THEN RAISE EXCEPTION 'Salida con orden activa en bus %',b; END IF;
   SELECT kilometraje_actual INTO STRICT km FROM buses WHERE id=b;
   UPDATE jornadas_operativas SET estado='EN_CURSO',inicio_real=t,iniciada_por_id=actor,updated_at=t WHERE id=jid AND estado='PROGRAMADA';
   IF NOT FOUND THEN RAISE EXCEPTION 'No se puede iniciar jornada %',jid; END IF;
   INSERT INTO demo_refs(key,id,start_km,data) VALUES('run:'||k,jid,km,d);
   PERFORM pg_temp.reading(b,jid,NULL,NULL,actor,t,'INICIO_JORNADA',km,note||': salida simulada');
  WHEN 'JOURNEY_END' THEN
   jid:=pg_temp.ref(k);
   SELECT start_km+(d->>'distance')::integer INTO STRICT km FROM demo_refs WHERE key='run:'||k;
   UPDATE jornadas_operativas SET estado='FINALIZADA',fin_real=t,finalizada_por_id=actor,updated_at=t WHERE id=jid AND estado='EN_CURSO';
   IF NOT FOUND THEN RAISE EXCEPTION 'No se puede finalizar jornada %',jid; END IF;
   PERFORM pg_temp.reading(b,jid,NULL,NULL,actor,t,'FIN_JORNADA',km,note||': cierre y distancia de operación simulados, no odómetro observado en empresa');
  WHEN 'NOVELTY' THEN
   jid:=pg_temp.ref(d->>'journeyKey');
   SELECT start_km+floor((data->>'distance')::numeric*0.94)::integer INTO STRICT km FROM demo_refs WHERE key='run:'||(d->>'journeyKey');
   rid:=pg_temp.reading(b,jid,NULL,NULL,actor,t,'NOVEDAD',km,note||': lectura simulada durante el tramo final');
   INSERT INTO novedades(conductor_id,bus_id,fecha_reporte,tipo,descripcion,estado,jornada_operativa_id,lectura_kilometraje_id,fecha_ocurrencia,continuidad_informada,reportada_antes_salida,created_at,updated_at,criticidad,afecta_operacion,bloquea_disponibilidad)
   VALUES(actor,b,t,'Observación técnica simulada',d->>'description','PENDIENTE_REVISION',jid,rid,t,'SI',false,t,t,NULL,NULL,NULL) RETURNING id INTO nid;
   INSERT INTO demo_refs(key,id,data) VALUES(k,nid,d);
   IF d->>'review' IS NOT NULL THEN
    UPDATE novedades SET estado=CASE WHEN (d->>'resolved')::boolean IS TRUE THEN 'RESUELTA_SIN_ORDEN'::estado_novedad ELSE 'PENDIENTE_REVISION'::estado_novedad END,
     revisada_por_id=(p->>'admin')::integer,fecha_revision=(d->>'review')::timestamptz,observacion_revision=note||': revisión simulada al retorno a patio',clasificacion=CASE WHEN (d->>'blocking')::boolean THEN 'Requiere revisión en taller' ELSE 'Observación menor resuelta' END,
     criticidad=CASE WHEN (d->>'blocking')::boolean THEN 'MEDIA'::criticidad_novedad ELSE 'BAJA'::criticidad_novedad END,afecta_operacion=(d->>'blocking')::boolean,bloquea_disponibilidad=(d->>'blocking')::boolean,respuesta_operativa=CASE WHEN (d->>'resolved')::boolean IS TRUE THEN note||': elemento revisado y fijado; sin orden de taller' ELSE note||': utilizar reserva durante revisión técnica' END,updated_at=(d->>'review')::timestamptz WHERE id=nid;
   END IF;
  WHEN 'ORDER_CREATE' THEN
   sid:=COALESCE((d->>'scheduleId')::integer,pg_temp.ref(d->>'scheduleKey'));
   nid:=pg_temp.ref(d->>'noveltyKey');jid:=pg_temp.ref(d->>'journeyKey');
   IF d->>'existingId' IS NOT NULL THEN
    oid:=(d->>'existingId')::integer;
    IF NOT EXISTS(SELECT 1 FROM ordenes_trabajo WHERE id=oid AND bus_id=b AND estado IN('ASIGNADA','PENDIENTE_ASIGNACION')) THEN RAISE EXCEPTION 'Orden original cambió'; END IF;
   ELSE
    oldjson:=NULL;
    IF sid IS NOT NULL THEN
     SELECT * INTO STRICT schedule FROM programaciones_mantenimiento WHERE id=sid AND activa;
     SELECT * INTO STRICT planrow FROM planes_mantenimiento_preventivo WHERE id=schedule.plan_mantenimiento_preventivo_id;
     oldjson:=jsonb_build_object('schemaVersion',1,'busId',b,'planId',planrow.id,'planVersion',planrow.version,'claveTarea',planrow.clave_tarea,'actividad',planrow.actividad,'componente',planrow.componente,'criterio',planrow.criterio,'prioridad',planrow.prioridad,'origenRegla',planrow.origen_regla,'referenciaRegla',planrow.referencia_regla,'intervaloDias',planrow.intervalo_dias,'intervaloKm',planrow.intervalo_km,'bloqueaAlVencer',planrow.bloquea_al_vencer,'anticipacionDiasEfectiva',COALESCE(planrow.anticipacion_dias,7),'anticipacionKmEfectiva',COALESCE(planrow.anticipacion_km,500),'destinoAplicado',jsonb_build_object('tipo','BUS','busId',b),'origenPlan','BUS','fechaObjetivo',schedule.fecha_programada::text,'kilometrajeObjetivo',schedule.kilometraje_objetivo,'programacionId',sid,'materializadoAt',schedule.created_at);
    END IF;
    INSERT INTO ordenes_trabajo(codigo,bus_id,tipo,origen,prioridad,descripcion,estado,creada_por_id,fecha_creacion,novedad_id,jornada_operativa_id,programacion_mantenimiento_id,fecha_objetivo_preventivo,kilometraje_objetivo_preventivo,plan_aplicado,created_at,updated_at)
    VALUES(d->>'code',b,CASE WHEN sid IS NULL THEN 'CORRECTIVA'::tipo_orden_trabajo ELSE 'PREVENTIVA'::tipo_orden_trabajo END,CASE WHEN sid IS NULL THEN 'NOVEDAD'::origen_orden_trabajo ELSE 'PREVENTIVO'::origen_orden_trabajo END,'MEDIA',d->>'description','PENDIENTE_ASIGNACION',actor,t,nid,jid,sid,CASE WHEN sid IS NOT NULL THEN schedule.fecha_programada END,CASE WHEN sid IS NOT NULL THEN schedule.kilometraje_objetivo END,oldjson,t,t) RETURNING id INTO oid;
    INSERT INTO orden_estado_historial(orden_trabajo_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,observacion) VALUES(oid,NULL,'PENDIENTE_ASIGNACION',actor,t,note||': creación simulada con origen conservado');
   END IF;
   INSERT INTO demo_refs(key,id,data) VALUES(k,oid,d);
   IF nid IS NOT NULL THEN UPDATE novedades SET estado='CONVERTIDA_A_ORDEN',updated_at=t WHERE id=nid; END IF;
  WHEN 'ORDER_ASSIGN' THEN
   oid:=pg_temp.ref(k);tech:=(d->>'tech')::integer;
   INSERT INTO orden_estado_historial(orden_trabajo_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,observacion) SELECT id,estado,'ASIGNADA',actor,t,note||': asignación simulada a técnico' FROM ordenes_trabajo WHERE id=oid;
   UPDATE ordenes_trabajo SET estado='ASIGNADA',tecnico_asignado_id=tech,fecha_asignacion=t,updated_at=t WHERE id=oid;
  WHEN 'ORDER_START' THEN
   oid:=pg_temp.ref(k);tech:=(d->>'tech')::integer;
   IF EXISTS(SELECT 1 FROM jornadas_operativas WHERE bus_id=b AND estado='EN_CURSO') THEN RAISE EXCEPTION 'Taller con jornada abierta en bus %',b; END IF;
   UPDATE ordenes_trabajo SET fecha_inicio_ejecucion=t WHERE id=oid;
   PERFORM pg_temp.transition(oid,'EN_EJECUCION',actor,t,note||': inicio técnico simulado');
   INSERT INTO intervenciones(orden_trabajo_id,tecnico_id,fecha_inicio,diagnostico,observaciones,created_at,updated_at)
   VALUES(oid,tech,t,note||': inspección y diagnóstico académico del componente',note||': actividad generada por continuidad de la demo, sin evidencia empresarial',t,t) RETURNING id INTO iid;
   UPDATE demo_refs SET aux=iid WHERE key=k;
   SELECT kilometraje_actual,estado_operativo INTO km,oldstate FROM buses WHERE id=b;
   PERFORM pg_temp.reading(b,NULL,oid,iid,actor,t,'INGRESO_TALLER',km,note||': ingreso a taller simulado');
   IF oldstate<>'EN_MANTENIMIENTO' THEN
    INSERT INTO bus_estado_historial(bus_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,motivo) VALUES(b,oldstate,'EN_MANTENIMIENTO',(p->>'admin')::integer,t,note||': coordinación registra ingreso técnico');
    UPDATE buses SET estado_operativo='EN_MANTENIMIENTO',updated_at=t WHERE id=b;
   END IF;
  WHEN 'ORDER_ACTIVITY' THEN
   oid:=pg_temp.ref(k);SELECT aux INTO STRICT iid FROM demo_refs WHERE key=k;
   INSERT INTO actividades_orden(intervencion_id,descripcion,fecha_registro,registrada_por_id) VALUES(iid,d->>'text',t,actor);
  WHEN 'CONSUME' THEN
   oid:=pg_temp.ref(k);SELECT aux INTO STRICT iid FROM demo_refs WHERE key=k;
   rid:=(d->>'partId')::integer;qty:=(d->>'quantity')::numeric;
   SELECT costo_unitario INTO STRICT cost FROM repuestos WHERE id=rid AND estado='ACTIVO' FOR UPDATE;
   SELECT id INTO STRICT cid FROM compatibilidades_repuesto WHERE repuesto_id=rid AND vigente AND permitido AND modelo_bus_id=(SELECT modelo_bus_id FROM buses WHERE id=(SELECT bus_id FROM ordenes_trabajo WHERE id=oid));
   UPDATE repuestos SET stock_actual=stock_actual-qty,updated_at=t WHERE id=rid AND stock_actual>=qty;
   IF NOT FOUND THEN RAISE EXCEPTION 'Existencias insuficientes en repuesto %',rid; END IF;
   INSERT INTO consumos_repuesto(orden_trabajo_id,repuesto_id,cantidad,costo_unitario,subtotal,consumido_por_id,clave_idempotencia,fecha_consumo,created_at,intervencion_id,resultado_compatibilidad,regla_compatibilidad_id,regla_version,evidencia_compatibilidad)
   VALUES(oid,rid,qty,cost,round(qty*cost,2),actor,gen_random_uuid(),t,t,iid,'COMPATIBLE',cid,(SELECT version FROM compatibilidades_repuesto WHERE id=cid),jsonb_build_object('origen','SIMULADO_SGMV','contexto',note,'reglaId',cid)) RETURNING id INTO mid;
   INSERT INTO movimientos_inventario(repuesto_id,tipo,cantidad,costo_unitario,motivo,responsable_id,consumo_repuesto_id,clave_idempotencia,fecha_movimiento,created_at)
   VALUES(rid,'CONSUMO',qty,cost,note||': consumo técnico trazable',actor,mid,gen_random_uuid(),t,t);
  WHEN 'ORDER_COMPLETE' THEN
   oid:=pg_temp.ref(k);SELECT aux INTO STRICT iid FROM demo_refs WHERE key=k;
   UPDATE intervenciones SET fecha_fin=t,updated_at=t WHERE id=iid;
   UPDATE ordenes_trabajo SET fecha_completada_tecnico=t WHERE id=oid;
   PERFORM pg_temp.transition(oid,'COMPLETADA_TECNICO',actor,t,note||': trabajo técnico finalizado; revisión administrativa requerida');
  WHEN 'ORDER_CLOSE' THEN
   oid:=pg_temp.ref(k);SELECT aux,data INTO iid,d FROM demo_refs WHERE key=k;
   SELECT kilometraje_actual INTO STRICT km FROM buses WHERE id=b;
   PERFORM pg_temp.reading(b,NULL,oid,iid,actor,t,'CIERRE_MANTENIMIENTO',km,note||': validación y cierre simulados');
   -- All cost-affecting operations precede terminal closure.
   UPDATE ordenes_trabajo SET fecha_cierre=t,cerrada_por_id=actor,disponibilidad_al_cierre=true WHERE id=oid;
   PERFORM pg_temp.transition(oid,'CERRADA',actor,t,note||': validación administrativa simulada');
   SELECT estado_operativo INTO oldstate FROM buses WHERE id=b;
   IF oldstate<>'OPERATIVO' THEN
    INSERT INTO bus_estado_historial(bus_id,estado_anterior,estado_nuevo,cambiado_por_id,fecha_cambio,motivo) VALUES(b,oldstate,'OPERATIVO',actor,t,note||': liberación tras validación');
    UPDATE buses SET estado_operativo='OPERATIVO',updated_at=t WHERE id=b;
   END IF;
   SELECT programacion_mantenimiento_id INTO sid FROM ordenes_trabajo WHERE id=oid;
   IF sid IS NOT NULL THEN
    SELECT * INTO STRICT schedule FROM programaciones_mantenimiento WHERE id=sid;
    SELECT * INTO STRICT planrow FROM planes_mantenimiento_preventivo WHERE id=schedule.plan_mantenimiento_preventivo_id;
    UPDATE programaciones_mantenimiento SET activa=false,updated_at=t WHERE id=sid;
    INSERT INTO programaciones_mantenimiento(bus_id,tipo,actividad,criterio,fecha_programada,kilometraje_objetivo,activa,creada_por_id,created_at,updated_at,plan_mantenimiento_preventivo_id,prioridad)
    VALUES(b,schedule.tipo,schedule.actividad,schedule.criterio,CASE WHEN planrow.intervalo_dias IS NOT NULL THEN schedule.fecha_programada+planrow.intervalo_dias END,CASE WHEN planrow.intervalo_km IS NOT NULL THEN schedule.kilometraje_objetivo+planrow.intervalo_km END,true,actor,t,t,planrow.id,schedule.prioridad) RETURNING id INTO rid;
    INSERT INTO demo_refs(key,id) VALUES('schedule:'||k,rid);
   END IF;
  WHEN 'STOCK_ENTRY' THEN
   rid:=(d->>'partId')::integer;qty:=(d->>'quantity')::numeric;
   SELECT costo_unitario INTO STRICT cost FROM repuestos WHERE id=rid;
   UPDATE repuestos SET stock_actual=stock_actual+qty,updated_at=t WHERE id=rid;
   INSERT INTO movimientos_inventario(repuesto_id,tipo,cantidad,costo_unitario,motivo,responsable_id,clave_idempotencia,fecha_movimiento,created_at)
   VALUES(rid,'ENTRADA',qty,cost,note||': reposición académica; no compra empresarial',actor,gen_random_uuid(),t,t);
  ELSE RAISE EXCEPTION 'Tipo de evento no reconocido: %',e->>'kind';
  END CASE;
 END LOOP;

 -- Attend superseded alerts, without deleting alert or audit history.
 UPDATE alertas_destinatarios ad SET estado='ATENDIDA',fecha_lectura=COALESCE(ad.fecha_lectura,GREATEST(ai.fecha_generacion,(p->>'cutoff')::timestamptz)),fecha_atencion=GREATEST(ai.fecha_generacion,(p->>'cutoff')::timestamptz),updated_at=clock_timestamp()
 FROM alertas_internas ai WHERE ad.alerta_interna_id=ai.id AND ad.estado<>'ATENDIDA'
 AND (ai.bus_id IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds'))
 OR ai.jornada_operativa_id IN(SELECT id FROM jornadas_operativas WHERE bus_id IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds')))
 OR ai.programacion_mantenimiento_id IN(SELECT id FROM programaciones_mantenimiento WHERE bus_id IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds')))
 OR ai.orden_trabajo_id IN(SELECT id FROM ordenes_trabajo WHERE bus_id IN(SELECT value::integer FROM jsonb_array_elements_text(p->'busIds'))))
 AND ((ai.jornada_operativa_id IS NOT NULL AND EXISTS(SELECT 1 FROM jornadas_operativas j WHERE j.id=ai.jornada_operativa_id AND j.estado IN('FINALIZADA','REASIGNADA','CANCELADA')))
 OR (ai.programacion_mantenimiento_id IS NOT NULL AND EXISTS(SELECT 1 FROM programaciones_mantenimiento s WHERE s.id=ai.programacion_mantenimiento_id AND NOT s.activa))
 OR (ai.orden_trabajo_id IS NOT NULL AND EXISTS(SELECT 1 FROM ordenes_trabajo o WHERE o.id=ai.orden_trabajo_id AND o.estado='CERRADA')));
 -- Current tasks remain visible to the exact existing actors, not to a new role.
 FOR rec IN SELECT o.* FROM ordenes_trabajo o WHERE o.codigo LIKE 'SIM261109-C-A-%' LOOP
  INSERT INTO alertas_internas(tipo,prioridad,titulo,mensaje,fecha_generacion,clave_deduplicacion,contexto_evento,orden_trabajo_id,created_at)
  VALUES(CASE WHEN rec.estado='COMPLETADA_TECNICO' THEN 'ORDEN_COMPLETADA_TECNICO'::tipo_alerta ELSE 'ORDEN_ASIGNADA'::tipo_alerta END,'MEDIA','Caso activo de operación simulada',note||': '||rec.codigo||' · '||rec.estado,(p->>'cutoff')::timestamptz,'demo-continuidad:'||rec.codigo,jsonb_build_object('origen','SIMULADO_SGMV','runId',p->>'runId'),rec.id,clock_timestamp()) RETURNING id INTO aid;
  INSERT INTO alertas_destinatarios(alerta_interna_id,usuario_id,estado,created_at,updated_at) VALUES(aid,(p->>'admin')::integer,'NO_LEIDA',clock_timestamp(),clock_timestamp()),(aid,rec.tecnico_asignado_id,'NO_LEIDA',clock_timestamp(),clock_timestamp());
 END LOOP;
 SELECT id INTO nid FROM demo_refs WHERE key='N-PENDIENTE';
 INSERT INTO alertas_internas(tipo,prioridad,titulo,mensaje,fecha_generacion,clave_deduplicacion,contexto_evento,novedad_id,created_at)
 SELECT 'CAMBIO_ESTADO_NOVEDAD','MEDIA','Novedad simulada pendiente de revisión',note||': coordinación debe revisar la observación del conductor',(p->>'cutoff')::timestamptz,'demo-continuidad:novedad-pendiente',jsonb_build_object('origen','SIMULADO_SGMV'),id,clock_timestamp() FROM novedades WHERE id=nid RETURNING id INTO aid;
 INSERT INTO alertas_destinatarios(alerta_interna_id,usuario_id,estado,created_at,updated_at) VALUES(aid,(p->>'admin')::integer,'NO_LEIDA',clock_timestamp(),clock_timestamp()),(aid,(p->>'dispatcher')::integer,'NO_LEIDA',clock_timestamp(),clock_timestamp());

 FOR rec IN SELECT * FROM demo_preserved LOOP
  EXECUTE format('SELECT md5(to_jsonb(x)::text) FROM public.%I x WHERE id=$1',rec.tab) INTO k USING rec.id;
  IF k IS DISTINCT FROM rec.digest THEN RAISE EXCEPTION 'Fila protegida alterada: %.%',rec.tab,rec.id; END IF;
 END LOOP;
 INSERT INTO eventos_auditoria(request_id,actor_id,accion,metodo,ruta,recurso_tipo,recurso_id,resultado,status_http,detalles,fecha_evento)
 VALUES((p->>'runId')::uuid,(p->>'admin')::integer,'DEMO_CONTINUIDAD_COMPLETA','POST','/maintenance/demo-continuidad','SIMULADO_SGMV',p->>'runId','EXITO',201,jsonb_build_object('origen','SIMULADO_SGMV','modoAplicacion','IMPORTACION_SQL_CONTROLADA_NO_HTTP; POST es la categoría compatible con el contrato de auditoría existente','autorizacion','Orden explícita del propietario 09-11-2026: simular continuidad operativa del período transcurrido','cutoff',p->>'cutoff','generatedAt',clock_timestamp(),'sourceFingerprint',p->>'sourceFingerprint','summary',p->'summary','events',p->'events'),clock_timestamp());
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
CREATE TEMP TABLE demo_validation AS /*VERIFY_QUERY*/;
DO $$
DECLARE v_checks jsonb;
BEGIN
 SELECT result::jsonb->'checks' INTO v_checks FROM demo_validation;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(v_checks) WHERE value::integer<>0) THEN RAISE EXCEPTION 'Incoherencia antes de confirmar: %',v_checks; END IF;
END $$;
SELECT json_build_object('committedBatch',plan->>'runId','eventCount',jsonb_array_length(plan->'events'),'cutoff',plan->>'cutoff') FROM demo_input;
COMMIT;
