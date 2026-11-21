import { type JornadaOperativa, Prisma } from '@prisma/client'

import type { JourneyRecord, JourneyTransaction } from './journey.repository.js'

type JourneyRelations = Omit<JourneyRecord, keyof JornadaOperativa>
type JsonDate<T> = T extends Date ? string : T
type JsonDates<T> = { [K in keyof T]: JsonDate<T[K]> }
type SqlRelations = Omit<JourneyRelations, 'bus' | 'lecturasKilometraje' | 'ruta'> & {
  id: number
  bus: Omit<JourneyRelations['bus'], 'lecturasKilometraje'>
  referencia: JsonDates<JourneyRelations['bus']['lecturasKilometraje'][number]> | null
  lecturasKilometraje: JsonDates<JourneyRelations['lecturasKilometraje'][number]>[]
  ruta:
    | (Omit<NonNullable<JourneyRelations['ruta']>, 'longitudKmOficial'> & {
        longitudKmOficial: string | null
      })
    | null
}

/** Carga las referencias de una página en una sola consulta, sin expandir ni modificar sus filtros. */
export async function loadJourneyRelations(
  db: JourneyTransaction,
  journeys: JornadaOperativa[],
): Promise<JourneyRecord[]> {
  if (!journeys.length) return []

  const pageKeys = journeys.map((journey) => ({
    id: journey.id,
    bus: journey.busId,
    ruta: journey.rutaId,
    conductor: journey.conductorId,
    programada: journey.programadaPorId,
    iniciada: journey.iniciadaPorId,
    finalizada: journey.finalizadaPorId,
    cambiada: journey.cambioPorId,
    conciliada: journey.conciliadaPorId,
  }))
  const relations = await db.$queryRaw<SqlRelations[]>`
    WITH pagina AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(pageKeys)}::jsonb) AS claves(
        id integer, bus integer, ruta integer, conductor integer, programada integer,
        iniciada integer, finalizada integer, cambiada integer, conciliada integer
      )
    ), lecturas AS (
      SELECT l.*
      FROM lecturas_kilometraje l
      JOIN pagina p ON p.id = l.jornada_operativa_id
      WHERE l.tipo IN ('INICIO_JORNADA', 'FIN_JORNADA')
    ), participantes AS (
      SELECT conductor, programada, iniciada, finalizada, cambiada, conciliada
      FROM pagina
      UNION ALL
      SELECT registrado_por_id, observado_por_id, NULL, NULL, NULL, NULL FROM lecturas
    ), usuarios_pagina AS (
      SELECT u.id, jsonb_build_object(
        'id', u.id, 'nombre', u.nombre, 'estado', u.estado,
        'rol', jsonb_build_object('codigo', r.codigo)
      ) AS usuario
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.id IN (
        SELECT unnest(ARRAY[conductor, programada, iniciada, finalizada, cambiada, conciliada])
        FROM participantes
      )
    ), lecturas_jornada AS (
      SELECT l.jornada_operativa_id, jsonb_agg(jsonb_build_object(
        'id', l.id, 'busId', l.bus_id, 'jornadaOperativaId', l.jornada_operativa_id,
        'kilometrajeAnterior', l.kilometraje_anterior, 'kilometrajeNuevo', l.kilometraje_nuevo,
        'registradoPorId', l.registrado_por_id, 'observadoPorId', l.observado_por_id,
        'fechaRegistro', l.fecha_registro, 'fechaLectura', l.fecha_lectura, 'tipo', l.tipo,
        'motivo', l.motivo, 'motivoRespaldo', l.motivo_respaldo, 'contexto', l.contexto,
        'ordenTrabajoId', l.orden_trabajo_id, 'intervencionId', l.intervencion_id,
        'registradoPor', registrado.usuario, 'observadoPor', observado.usuario
      ) ORDER BY l.fecha_lectura, l.fecha_registro) AS filas
      FROM lecturas l
      JOIN usuarios_pagina registrado ON registrado.id = l.registrado_por_id
      LEFT JOIN usuarios_pagina observado ON observado.id = l.observado_por_id
      GROUP BY l.jornada_operativa_id
    ), referencias_bus AS (
      SELECT b.id, jsonb_build_object(
        'id', b.id, 'codigoInterno', b.codigo_interno, 'placa', b.placa,
        'estadoOperativo', b.estado_operativo, 'kilometrajeActual', b.kilometraje_actual
      ) AS bus, ref.lectura
      FROM buses b
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'kilometrajeNuevo', l.kilometraje_nuevo, 'fechaLectura', l.fecha_lectura,
          'fechaRegistro', l.fecha_registro
        ) AS lectura
        FROM lecturas_kilometraje l
        WHERE l.bus_id = b.id AND l.fecha_lectura IS NOT NULL
        ORDER BY l.fecha_lectura DESC NULLS LAST, l.fecha_registro DESC, l.id DESC
        LIMIT 1
      ) ref ON true
      WHERE b.id IN (SELECT bus FROM pagina)
    )
    SELECT p.id, b.bus, b.lectura AS referencia,
      conductor.usuario AS conductor, programada.usuario AS "programadaPor",
      iniciada.usuario AS "iniciadaPor", finalizada.usuario AS "finalizadaPor",
      cambiada.usuario AS "cambioPor", conciliada.usuario AS "conciliadaPor",
      CASE WHEN siguiente.id IS NOT NULL THEN jsonb_build_object('id', siguiente.id) END
        AS "jornadaSucesora",
      coalesce(lecturas_jornada.filas, '[]'::jsonb) AS "lecturasKilometraje",
      CASE WHEN r.id IS NOT NULL THEN jsonb_build_object(
        'id', r.id, 'codigo', r.codigo, 'nombre', r.nombre, 'origen', r.origen,
        'destino', r.destino, 'longitudKmOficial', r.longitud_km_oficial::text,
        'operador', r.operador, 'origenDato', r.origen_dato,
        'semanticaLongitudOficial', r.semantica_longitud_oficial,
        'semanticaLongitudDemo', r.semantica_longitud_demo,
        'origenSemanticaDemo', r.origen_semantica_demo, 'procedencia', r.procedencia
      ) END AS ruta
    FROM pagina p
    JOIN referencias_bus b ON b.id = p.bus
    JOIN usuarios_pagina conductor ON conductor.id = p.conductor
    JOIN usuarios_pagina programada ON programada.id = p.programada
    LEFT JOIN usuarios_pagina iniciada ON iniciada.id = p.iniciada
    LEFT JOIN usuarios_pagina finalizada ON finalizada.id = p.finalizada
    LEFT JOIN usuarios_pagina cambiada ON cambiada.id = p.cambiada
    LEFT JOIN usuarios_pagina conciliada ON conciliada.id = p.conciliada
    LEFT JOIN jornadas_operativas siguiente ON siguiente.jornada_anterior_id = p.id
    LEFT JOIN lecturas_jornada ON lecturas_jornada.jornada_operativa_id = p.id
    LEFT JOIN rutas r ON r.id = p.ruta
  `
  const byId = new Map(relations.map((relation) => [relation.id, relation]))
  return journeys.map((journey) => {
    const relation = byId.get(journey.id)
    if (!relation) throw new Error('La jornada no tiene todas sus referencias requeridas')

    const { bus, referencia, lecturasKilometraje, ruta, ...usuariosYSucesion } = relation
    return {
      ...journey,
      ...usuariosYSucesion,
      bus: {
        ...bus,
        lecturasKilometraje: referencia
          ? [
              {
                ...referencia,
                fechaLectura: referencia.fechaLectura ? new Date(referencia.fechaLectura) : null,
                fechaRegistro: new Date(referencia.fechaRegistro),
              },
            ]
          : [],
      },
      lecturasKilometraje: lecturasKilometraje.map((lectura) => ({
        ...lectura,
        fechaLectura: lectura.fechaLectura ? new Date(lectura.fechaLectura) : null,
        fechaRegistro: new Date(lectura.fechaRegistro),
      })),
      ruta: ruta
        ? {
            ...ruta,
            longitudKmOficial: ruta.longitudKmOficial
              ? new Prisma.Decimal(ruta.longitudKmOficial)
              : null,
          }
        : null,
    }
  })
}
