WITH chain AS (
 SELECT l.*,lag(kilometraje_nuevo) OVER(PARTITION BY bus_id ORDER BY fecha_lectura,id) previous FROM lecturas_kilometraje l
)
SELECT json_build_object(
 'activeBusesWithoutActiveDriver',(SELECT count(*) FROM buses b WHERE b.estado_operativo<>'INACTIVO' AND NOT EXISTS(SELECT 1 FROM asignaciones_conductor a JOIN usuarios u ON u.id=a.conductor_id WHERE a.bus_id=b.id AND a.activa AND u.estado='ACTIVO')),
 'assignmentsToInactiveDrivers',(SELECT count(*) FROM asignaciones_conductor a JOIN usuarios u ON u.id=a.conductor_id WHERE a.activa AND u.estado<>'ACTIVO'),
 'openOrders',(SELECT count(*) FROM ordenes_trabajo WHERE estado NOT IN('CERRADA','ANULADA')),
 'pendingNovelties',(SELECT count(*) FROM novedades WHERE estado='PENDIENTE_REVISION'),
 'overdueActiveSchedules',(SELECT count(*) FROM programaciones_mantenimiento s JOIN buses b ON b.id=s.bus_id WHERE s.activa AND ((s.fecha_programada IS NOT NULL AND s.fecha_programada<(clock_timestamp() AT TIME ZONE 'America/Bogota')::date) OR (s.kilometraje_objetivo IS NOT NULL AND s.kilometraje_objetivo<=b.kilometraje_actual))),
 'staleScheduledJourneys',(SELECT count(*) FROM jornadas_operativas WHERE estado='PROGRAMADA' AND fin_programado<clock_timestamp()),
 'staleOpenJourneys',(SELECT count(*) FROM jornadas_operativas WHERE estado='EN_CURSO' AND fin_programado<clock_timestamp()),
 'futureExecution',(SELECT count(*) FROM lecturas_kilometraje WHERE fecha_lectura>clock_timestamp()),
 'futureJourneysExecuted',(SELECT count(*) FROM jornadas_operativas WHERE inicio_programado>clock_timestamp() AND (inicio_real IS NOT NULL OR fin_real IS NOT NULL)),
 'missingStartReading',(SELECT count(*) FROM jornadas_operativas j WHERE inicio_real IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lecturas_kilometraje l WHERE l.jornada_operativa_id=j.id AND l.tipo='INICIO_JORNADA' AND l.fecha_lectura=j.inicio_real)),
 'missingFinalReading',(SELECT count(*) FROM jornadas_operativas j WHERE estado='FINALIZADA' AND NOT EXISTS(SELECT 1 FROM lecturas_kilometraje l WHERE l.jornada_operativa_id=j.id AND l.tipo='FIN_JORNADA' AND l.fecha_lectura=j.fin_real)),
 'brokenMileageChain',(SELECT count(*) FROM chain WHERE previous IS NOT NULL AND previous<>kilometraje_anterior),
 'overlappingTechnicalWork',(SELECT count(*) FROM intervenciones a JOIN intervenciones b ON a.id<b.id AND a.tecnico_id=b.tecnico_id AND tstzrange(a.fecha_inicio,COALESCE(a.fecha_fin,'infinity'::timestamptz),'[)') && tstzrange(b.fecha_inicio,COALESCE(b.fecha_fin,'infinity'::timestamptz),'[)')),
 'lowStockActiveParts',(SELECT count(*) FROM repuestos WHERE estado='ACTIVO' AND stock_actual<=stock_minimo)
);
