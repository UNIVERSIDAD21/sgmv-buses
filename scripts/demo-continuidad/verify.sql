WITH scope AS (SELECT id FROM buses WHERE codigo_interno ~ '^SIM-(UNITRANSA|TRANSCOLOMBIA|COTRANDER|TRANSGIRON|ORIENTAL|COOTRAGAS|LUSITANIA|METROPOLITANA|SANJUAN|PIEDECUESTA|VILLASANCARLOS)-0[12]$'),
chain AS (SELECT l.*,lag(kilometraje_nuevo) OVER(PARTITION BY bus_id ORDER BY fecha_lectura,id) previous FROM lecturas_kilometraje l WHERE bus_id IN(SELECT id FROM scope)),
batch AS (SELECT detalles FROM eventos_auditoria WHERE request_id='cc261109-0000-4000-8000-000000000001'::uuid AND accion='DEMO_CONTINUIDAD_COMPLETA')
SELECT json_build_object('checks',json_build_object(
 'missingStartReading',(SELECT count(*) FROM jornadas_operativas j WHERE bus_id IN(SELECT id FROM scope) AND inicio_real IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lecturas_kilometraje l WHERE l.jornada_operativa_id=j.id AND l.tipo='INICIO_JORNADA' AND l.fecha_lectura=j.inicio_real)),
 'missingFinalReading',(SELECT count(*) FROM jornadas_operativas j WHERE bus_id IN(SELECT id FROM scope) AND estado='FINALIZADA' AND NOT EXISTS(SELECT 1 FROM lecturas_kilometraje l WHERE l.jornada_operativa_id=j.id AND l.tipo='FIN_JORNADA' AND l.fecha_lectura=j.fin_real)),
 'brokenMileageChain',(SELECT count(*) FROM chain WHERE previous IS NOT NULL AND previous<>kilometraje_anterior),
 'futureExecution',(SELECT count(*) FROM lecturas_kilometraje WHERE bus_id IN(SELECT id FROM scope) AND fecha_lectura>clock_timestamp()),
 'overlappingTechnicalWork',(SELECT count(*) FROM intervenciones a JOIN intervenciones b ON a.id<b.id AND a.tecnico_id=b.tecnico_id AND tstzrange(a.fecha_inicio,COALESCE(a.fecha_fin,'infinity'::timestamptz),'[)') && tstzrange(b.fecha_inicio,COALESCE(b.fecha_fin,'infinity'::timestamptz),'[)') JOIN ordenes_trabajo o ON o.id=a.orden_trabajo_id WHERE o.bus_id IN(SELECT id FROM scope)),
 'journeyDuringTechnicalBlock',(SELECT count(*) FROM jornadas_operativas j JOIN ordenes_trabajo o ON o.bus_id=j.bus_id WHERE j.bus_id IN(SELECT id FROM scope) AND j.inicio_real IS NOT NULL AND o.fecha_asignacion IS NOT NULL AND tstzrange(j.inicio_real,COALESCE(j.fin_real,'infinity'::timestamptz),'[)') && tstzrange(o.fecha_asignacion,COALESCE(o.fecha_cierre,'infinity'::timestamptz),'[)')),
 'wrongOrderCost',(SELECT count(*) FROM ordenes_trabajo o WHERE o.bus_id IN(SELECT id FROM scope) AND o.costo_total<>COALESCE((SELECT sum(c.subtotal) FROM consumos_repuesto c WHERE c.orden_trabajo_id=o.id),0)),
 'missingConsumptionMovement',(SELECT count(*) FROM consumos_repuesto c JOIN ordenes_trabajo o ON o.id=c.orden_trabajo_id WHERE o.bus_id IN(SELECT id FROM scope) AND (SELECT count(*) FROM movimientos_inventario m WHERE m.consumo_repuesto_id=c.id AND m.tipo='CONSUMO')<>1),
 'stockMismatch',(SELECT count(*) FROM repuestos r WHERE r.codigo LIKE 'SIM-AMB-REP-%' AND r.stock_actual<>COALESCE((SELECT sum(CASE WHEN tipo IN('ENTRADA','AJUSTE_ENTRADA','REVERSO_CONSUMO') THEN cantidad ELSE -cantidad END) FROM movimientos_inventario m WHERE m.repuesto_id=r.id),0)),
 'expiredWeeklyTarget',(SELECT count(*) FROM programaciones_mantenimiento s JOIN planes_mantenimiento_preventivo p ON p.id=s.plan_mantenimiento_preventivo_id WHERE s.bus_id IN(SELECT id FROM scope) AND s.activa AND p.clave_tarea='SIM.AMB.INSPECCION' AND s.fecha_programada<((SELECT (detalles->>'cutoff')::timestamptz FROM batch) AT TIME ZONE 'America/Bogota')::date)
),'counts',json_build_object(
 'journeys',(SELECT json_agg(to_jsonb(g)) FROM(SELECT estado,count(*) FROM jornadas_operativas WHERE bus_id IN(SELECT id FROM scope) GROUP BY estado ORDER BY estado)g),
 'orders',(SELECT json_agg(to_jsonb(g)) FROM(SELECT estado,count(*) FROM ordenes_trabajo WHERE bus_id IN(SELECT id FROM scope) GROUP BY estado ORDER BY estado)g),
 'novelties',(SELECT json_agg(to_jsonb(g)) FROM(SELECT estado,count(*) FROM novedades WHERE bus_id IN(SELECT id FROM scope) GROUP BY estado ORDER BY estado)g),
 'readings',(SELECT count(*) FROM lecturas_kilometraje WHERE bus_id IN(SELECT id FROM scope)),
 'activeSchedules',(SELECT count(*) FROM programaciones_mantenimiento WHERE bus_id IN(SELECT id FROM scope) AND activa),
 'nextWeeklyDates',(SELECT json_agg(DISTINCT s.fecha_programada) FROM programaciones_mantenimiento s JOIN planes_mantenimiento_preventivo p ON p.id=s.plan_mantenimiento_preventivo_id WHERE s.bus_id IN(SELECT id FROM scope) AND s.activa AND p.clave_tarea='SIM.AMB.INSPECCION'),
 'parts',(SELECT json_agg(json_build_object('code',codigo,'stock',stock_actual)) FROM repuestos WHERE codigo LIKE 'SIM-AMB-REP-%')
)) AS result;
