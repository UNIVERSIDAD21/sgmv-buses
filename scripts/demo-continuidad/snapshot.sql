BEGIN READ ONLY;
WITH scope AS (
 SELECT id FROM buses WHERE origen_datos='SIMULADO_SGMV'
 AND codigo_interno ~ '^SIM-(UNITRANSA|TRANSCOLOMBIA|COTRANDER|TRANSGIRON|ORIENTAL|COOTRAGAS|LUSITANIA|METROPOLITANA|SANJUAN|PIEDECUESTA|VILLASANCARLOS)-0[12]$'
)
SELECT json_build_object(
 'buses',(SELECT json_agg(to_jsonb(b) ORDER BY id) FROM buses b WHERE id IN(SELECT id FROM scope)),
 'journeys',(SELECT json_agg(to_jsonb(j) ORDER BY id) FROM jornadas_operativas j WHERE bus_id IN(SELECT id FROM scope)),
 'plans',(SELECT json_agg(to_jsonb(p) ORDER BY id) FROM planes_mantenimiento_preventivo p WHERE bus_id IN(SELECT id FROM scope)),
 'schedules',(SELECT json_agg(to_jsonb(p) ORDER BY id) FROM programaciones_mantenimiento p WHERE bus_id IN(SELECT id FROM scope)),
 'orders',(SELECT json_agg(to_jsonb(o) ORDER BY id) FROM ordenes_trabajo o WHERE bus_id IN(SELECT id FROM scope)),
 'users',(SELECT json_agg(json_build_object('id',u.id,'email',u.email,'estado',u.estado,'rol',r.codigo) ORDER BY u.id) FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.email LIKE '%demo@sgmv.local'),
 'parts',(SELECT json_agg(to_jsonb(p) ORDER BY id) FROM repuestos p WHERE codigo LIKE 'SIM-AMB-REP-%'),
 'rules',(SELECT json_agg(to_jsonb(c) ORDER BY id) FROM compatibilidades_repuesto c WHERE repuesto_id IN(SELECT id FROM repuestos WHERE codigo LIKE 'SIM-AMB-REP-%')),
 'protected',json_build_object(
  'users',(SELECT md5(string_agg(to_jsonb(u)::text,'|' ORDER BY id)) FROM usuarios u),
  'routes',(SELECT md5(string_agg(to_jsonb(r)::text,'|' ORDER BY id)) FROM rutas r),
  'plans',(SELECT md5(string_agg(to_jsonb(p)::text,'|' ORDER BY id)) FROM planes_mantenimiento_preventivo p),
  'otherBuses',(SELECT md5(string_agg(to_jsonb(b)::text,'|' ORDER BY id)) FROM buses b WHERE id NOT IN(SELECT id FROM scope)),
  'otherJourneys',(SELECT md5(string_agg(to_jsonb(j)::text,'|' ORDER BY id)) FROM jornadas_operativas j WHERE bus_id NOT IN(SELECT id FROM scope)),
  'otherOrders',(SELECT md5(string_agg(to_jsonb(o)::text,'|' ORDER BY id)) FROM ordenes_trabajo o WHERE bus_id NOT IN(SELECT id FROM scope)),
  'otherSchedules',(SELECT md5(string_agg(to_jsonb(p)::text,'|' ORDER BY id)) FROM programaciones_mantenimiento p WHERE bus_id NOT IN(SELECT id FROM scope)),
  'otherParts',(SELECT md5(string_agg(to_jsonb(p)::text,'|' ORDER BY id)) FROM repuestos p WHERE codigo NOT LIKE 'SIM-AMB-REP-%'),
  'photos',(SELECT md5(string_agg(to_jsonb(p)::text,'|' ORDER BY id)) FROM evidencias_novedad p)
 ),
 'migrations',(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)
);
COMMIT;
