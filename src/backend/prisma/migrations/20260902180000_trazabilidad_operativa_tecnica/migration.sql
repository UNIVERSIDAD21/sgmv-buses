-- Alineacion aditiva SGMV: trazabilidad operativa y tecnica.
-- Conserva las 16 tablas existentes, sus datos y las tres FK compuestas previas.
BEGIN;

-- CreateEnum
CREATE TYPE "estado_jornada" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA', 'REASIGNADA');

-- CreateEnum
CREATE TYPE "tipo_lectura" AS ENUM ('INICIO_JORNADA', 'FIN_JORNADA', 'NOVEDAD', 'INGRESO_TALLER', 'REVISION_TECNICA', 'CIERRE_MANTENIMIENTO', 'AJUSTE_ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "criticidad_novedad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "resultado_compatibilidad" AS ENUM ('COMPATIBLE', 'EXCEPCION_AUTORIZADA', 'NO_EVALUADA_LEGADO');

-- CreateEnum
CREATE TYPE "tipo_alerta" AS ENUM ('MANTENIMIENTO_PROXIMO', 'MANTENIMIENTO_VENCIDO', 'NOVEDAD_CRITICA', 'BUS_BLOQUEADO', 'CONFLICTO_JORNADA', 'JORNADA_SIN_KILOMETRAJE_INICIAL', 'JORNADA_SIN_KILOMETRAJE_FINAL', 'ORDEN_PENDIENTE_ASIGNACION', 'ORDEN_DEVUELTA', 'BAJO_INVENTARIO', 'CONSUMO_INCOMPATIBLE', 'CAMBIO_JORNADA');

-- CreateEnum
CREATE TYPE "prioridad_alerta" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "estado_alerta_destinatario" AS ENUM ('NO_LEIDA', 'LEIDA', 'ATENDIDA');

-- AlterTable
ALTER TABLE "buses" ADD COLUMN     "modelo_bus_id" UUID;

-- AlterTable
ALTER TABLE "consumos_repuesto" ADD COLUMN     "autorizado_por_id" UUID,
ADD COLUMN     "evidencia_compatibilidad" JSONB,
ADD COLUMN     "fecha_autorizacion" TIMESTAMPTZ(6),
ADD COLUMN     "intervencion_id" UUID,
ADD COLUMN     "motivo_excepcion" TEXT,
ADD COLUMN     "regla_compatibilidad_id" UUID,
ADD COLUMN     "regla_version" INTEGER,
ADD COLUMN     "resultado_compatibilidad" "resultado_compatibilidad";

-- AlterTable
ALTER TABLE "lecturas_kilometraje" ADD COLUMN     "fecha_lectura" TIMESTAMPTZ(6),
ADD COLUMN     "intervencion_id" UUID,
ADD COLUMN     "jornada_operativa_id" UUID,
ADD COLUMN     "orden_trabajo_id" UUID,
ADD COLUMN     "tipo" "tipo_lectura";

-- AlterTable
ALTER TABLE "novedades" ADD COLUMN     "afecta_operacion" BOOLEAN,
ADD COLUMN     "bloquea_disponibilidad" BOOLEAN,
ADD COLUMN     "criticidad" "criticidad_novedad",
ADD COLUMN     "fecha_ocurrencia" TIMESTAMPTZ(6),
ADD COLUMN     "jornada_operativa_id" UUID,
ADD COLUMN     "lectura_kilometraje_id" UUID;

-- AlterTable
ALTER TABLE "ordenes_trabajo" ADD COLUMN     "disponibilidad_al_cierre" BOOLEAN,
ADD COLUMN     "jornada_operativa_id" UUID,
ADD COLUMN     "plan_aplicado" JSONB;

-- AlterTable
ALTER TABLE "programaciones_mantenimiento" ADD COLUMN     "plan_mantenimiento_preventivo_id" UUID,
ADD COLUMN     "prioridad" "prioridad_orden";

-- AlterTable
ALTER TABLE "repuestos" ADD COLUMN     "dimensiones" JSONB,
ADD COLUMN     "especificaciones" JSONB,
ADD COLUMN     "fabricante" VARCHAR(120),
ADD COLUMN     "numero_parte" VARCHAR(120);

-- CreateTable
CREATE TABLE "modelos_bus" (
    "id" UUID NOT NULL,
    "marca" VARCHAR(100) NOT NULL,
    "nombre_modelo" VARCHAR(100) NOT NULL,
    "version_tecnica" VARCHAR(120),
    "especificaciones" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "modelos_bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutas" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "origen" VARCHAR(160) NOT NULL,
    "destino" VARCHAR(160) NOT NULL,
    "activa" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jornadas_operativas" (
    "id" UUID NOT NULL,
    "bus_id" UUID NOT NULL,
    "conductor_id" UUID NOT NULL,
    "ruta_id" UUID,
    "estado" "estado_jornada" NOT NULL,
    "inicio_programado" TIMESTAMPTZ(6) NOT NULL,
    "fin_programado" TIMESTAMPTZ(6) NOT NULL,
    "inicio_real" TIMESTAMPTZ(6),
    "fin_real" TIMESTAMPTZ(6),
    "programada_por_id" UUID NOT NULL,
    "cambio_por_id" UUID,
    "iniciada_por_id" UUID,
    "finalizada_por_id" UUID,
    "fecha_cambio" TIMESTAMPTZ(6),
    "motivo_cambio" TEXT,
    "jornada_anterior_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jornadas_operativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_mantenimiento_preventivo" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "clave_tarea" VARCHAR(120) NOT NULL,
    "bus_id" UUID,
    "modelo_bus_id" UUID,
    "componente" VARCHAR(160) NOT NULL,
    "actividad" TEXT NOT NULL,
    "criterio" "criterio_mantenimiento" NOT NULL,
    "intervalo_dias" INTEGER,
    "intervalo_km" INTEGER,
    "anticipacion_dias" INTEGER,
    "anticipacion_km" INTEGER,
    "prioridad" "prioridad_orden" NOT NULL,
    "bloquea_al_vencer" BOOLEAN NOT NULL,
    "activo" BOOLEAN NOT NULL,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planes_mantenimiento_preventivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibilidades_repuesto" (
    "id" UUID NOT NULL,
    "repuesto_id" UUID NOT NULL,
    "bus_id" UUID,
    "modelo_bus_id" UUID,
    "version" INTEGER NOT NULL,
    "permitido" BOOLEAN NOT NULL,
    "condicion_uso" TEXT,
    "especificaciones_validadas" JSONB NOT NULL,
    "vigente" BOOLEAN NOT NULL,
    "fecha_definicion" TIMESTAMPTZ(6) NOT NULL,
    "definida_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "compatibilidades_repuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_internas" (
    "id" UUID NOT NULL,
    "tipo" "tipo_alerta" NOT NULL,
    "prioridad" "prioridad_alerta" NOT NULL,
    "titulo" VARCHAR(180) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "fecha_generacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clave_deduplicacion" VARCHAR(255) NOT NULL,
    "contexto_evento" JSONB NOT NULL,
    "bus_id" UUID,
    "jornada_operativa_id" UUID,
    "novedad_id" UUID,
    "programacion_mantenimiento_id" UUID,
    "orden_trabajo_id" UUID,
    "repuesto_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_internas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_destinatarios" (
    "id" UUID NOT NULL,
    "alerta_interna_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "estado" "estado_alerta_destinatario" NOT NULL,
    "fecha_lectura" TIMESTAMPTZ(6),
    "fecha_atencion" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alertas_destinatarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_bus_marca_nombre_modelo_idx" ON "modelos_bus"("marca", "nombre_modelo");

-- CreateIndex
CREATE INDEX "modelos_bus_activo_idx" ON "modelos_bus"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "rutas_codigo_key" ON "rutas"("codigo");

-- CreateIndex
CREATE INDEX "rutas_activa_idx" ON "rutas"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "jornadas_operativas_jornada_anterior_id_key" ON "jornadas_operativas"("jornada_anterior_id");

-- CreateIndex
CREATE INDEX "jornadas_operativas_bus_id_inicio_programado_fin_programado_idx" ON "jornadas_operativas"("bus_id", "inicio_programado", "fin_programado");

-- CreateIndex
CREATE INDEX "jornadas_operativas_conductor_id_inicio_programado_fin_prog_idx" ON "jornadas_operativas"("conductor_id", "inicio_programado", "fin_programado");

-- CreateIndex
CREATE INDEX "jornadas_operativas_ruta_id_idx" ON "jornadas_operativas"("ruta_id");

-- CreateIndex
CREATE INDEX "jornadas_operativas_estado_idx" ON "jornadas_operativas"("estado");

-- CreateIndex
CREATE INDEX "jornadas_operativas_programada_por_id_idx" ON "jornadas_operativas"("programada_por_id");

-- CreateIndex
CREATE INDEX "jornadas_operativas_cambio_por_id_idx" ON "jornadas_operativas"("cambio_por_id");

-- CreateIndex
CREATE INDEX "jornadas_operativas_iniciada_por_id_idx" ON "jornadas_operativas"("iniciada_por_id");

-- CreateIndex
CREATE INDEX "jornadas_operativas_finalizada_por_id_idx" ON "jornadas_operativas"("finalizada_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "jornadas_operativas_id_bus_id_key" ON "jornadas_operativas"("id", "bus_id");

-- CreateIndex
CREATE UNIQUE INDEX "jornadas_operativas_id_bus_id_conductor_id_key" ON "jornadas_operativas"("id", "bus_id", "conductor_id");

-- CreateIndex
CREATE INDEX "planes_mantenimiento_preventivo_bus_id_clave_tarea_activo_idx" ON "planes_mantenimiento_preventivo"("bus_id", "clave_tarea", "activo");

-- CreateIndex
CREATE INDEX "planes_mantenimiento_preventivo_modelo_bus_id_clave_tarea_a_idx" ON "planes_mantenimiento_preventivo"("modelo_bus_id", "clave_tarea", "activo");

-- CreateIndex
CREATE INDEX "planes_mantenimiento_preventivo_creado_por_id_idx" ON "planes_mantenimiento_preventivo"("creado_por_id");

-- CreateIndex
CREATE INDEX "compatibilidades_repuesto_repuesto_id_vigente_idx" ON "compatibilidades_repuesto"("repuesto_id", "vigente");

-- CreateIndex
CREATE INDEX "compatibilidades_repuesto_bus_id_idx" ON "compatibilidades_repuesto"("bus_id");

-- CreateIndex
CREATE INDEX "compatibilidades_repuesto_modelo_bus_id_idx" ON "compatibilidades_repuesto"("modelo_bus_id");

-- CreateIndex
CREATE INDEX "compatibilidades_repuesto_definida_por_id_idx" ON "compatibilidades_repuesto"("definida_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "compatibilidades_repuesto_id_repuesto_id_key" ON "compatibilidades_repuesto"("id", "repuesto_id");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_internas_clave_deduplicacion_key" ON "alertas_internas"("clave_deduplicacion");

-- CreateIndex
CREATE INDEX "alertas_internas_tipo_fecha_generacion_idx" ON "alertas_internas"("tipo", "fecha_generacion");

-- CreateIndex
CREATE INDEX "alertas_internas_bus_id_idx" ON "alertas_internas"("bus_id");

-- CreateIndex
CREATE INDEX "alertas_internas_jornada_operativa_id_idx" ON "alertas_internas"("jornada_operativa_id");

-- CreateIndex
CREATE INDEX "alertas_internas_novedad_id_idx" ON "alertas_internas"("novedad_id");

-- CreateIndex
CREATE INDEX "alertas_internas_programacion_mantenimiento_id_idx" ON "alertas_internas"("programacion_mantenimiento_id");

-- CreateIndex
CREATE INDEX "alertas_internas_orden_trabajo_id_idx" ON "alertas_internas"("orden_trabajo_id");

-- CreateIndex
CREATE INDEX "alertas_internas_repuesto_id_idx" ON "alertas_internas"("repuesto_id");

-- CreateIndex
CREATE INDEX "alertas_destinatarios_usuario_id_estado_created_at_idx" ON "alertas_destinatarios"("usuario_id", "estado", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_destinatarios_alerta_interna_id_usuario_id_key" ON "alertas_destinatarios"("alerta_interna_id", "usuario_id");

-- CreateIndex
CREATE INDEX "buses_modelo_bus_id_idx" ON "buses"("modelo_bus_id");

-- CreateIndex
CREATE INDEX "consumos_repuesto_intervencion_id_idx" ON "consumos_repuesto"("intervencion_id");

-- CreateIndex
CREATE INDEX "consumos_repuesto_regla_compatibilidad_id_idx" ON "consumos_repuesto"("regla_compatibilidad_id");

-- CreateIndex
CREATE INDEX "consumos_repuesto_autorizado_por_id_idx" ON "consumos_repuesto"("autorizado_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "intervenciones_id_orden_trabajo_id_key" ON "intervenciones"("id", "orden_trabajo_id");

-- CreateIndex
CREATE INDEX "lecturas_kilometraje_bus_id_fecha_lectura_idx" ON "lecturas_kilometraje"("bus_id", "fecha_lectura");

-- CreateIndex
CREATE INDEX "lecturas_kilometraje_jornada_operativa_id_tipo_idx" ON "lecturas_kilometraje"("jornada_operativa_id", "tipo");

-- CreateIndex
CREATE INDEX "lecturas_kilometraje_orden_trabajo_id_tipo_idx" ON "lecturas_kilometraje"("orden_trabajo_id", "tipo");

-- CreateIndex
CREATE INDEX "lecturas_kilometraje_intervencion_id_idx" ON "lecturas_kilometraje"("intervencion_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturas_kilometraje_id_bus_id_key" ON "lecturas_kilometraje"("id", "bus_id");

-- CreateIndex
CREATE UNIQUE INDEX "novedades_lectura_kilometraje_id_key" ON "novedades"("lectura_kilometraje_id");

-- CreateIndex
CREATE INDEX "novedades_jornada_operativa_id_idx" ON "novedades"("jornada_operativa_id");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_jornada_operativa_id_idx" ON "ordenes_trabajo"("jornada_operativa_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_id_bus_id_key" ON "ordenes_trabajo"("id", "bus_id");

-- CreateIndex
CREATE INDEX "programaciones_mantenimiento_plan_mantenimiento_preventivo__idx" ON "programaciones_mantenimiento"("plan_mantenimiento_preventivo_id");

-- AddForeignKey
ALTER TABLE "buses" ADD CONSTRAINT "buses_modelo_bus_id_fkey" FOREIGN KEY ("modelo_bus_id") REFERENCES "modelos_bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_kilometraje" ADD CONSTRAINT "lecturas_kilometraje_jornada_operativa_id_fkey" FOREIGN KEY ("jornada_operativa_id") REFERENCES "jornadas_operativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_kilometraje" ADD CONSTRAINT "lecturas_kilometraje_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_kilometraje" ADD CONSTRAINT "lecturas_kilometraje_intervencion_id_fkey" FOREIGN KEY ("intervencion_id") REFERENCES "intervenciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_jornada_operativa_id_fkey" FOREIGN KEY ("jornada_operativa_id") REFERENCES "jornadas_operativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_lectura_kilometraje_id_fkey" FOREIGN KEY ("lectura_kilometraje_id") REFERENCES "lecturas_kilometraje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programaciones_mantenimiento" ADD CONSTRAINT "programaciones_mantenimiento_plan_mantenimiento_preventivo_fkey" FOREIGN KEY ("plan_mantenimiento_preventivo_id") REFERENCES "planes_mantenimiento_preventivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_jornada_operativa_id_fkey" FOREIGN KEY ("jornada_operativa_id") REFERENCES "jornadas_operativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_repuesto" ADD CONSTRAINT "consumos_repuesto_intervencion_id_fkey" FOREIGN KEY ("intervencion_id") REFERENCES "intervenciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_repuesto" ADD CONSTRAINT "consumos_repuesto_regla_compatibilidad_id_fkey" FOREIGN KEY ("regla_compatibilidad_id") REFERENCES "compatibilidades_repuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_repuesto" ADD CONSTRAINT "consumos_repuesto_autorizado_por_id_fkey" FOREIGN KEY ("autorizado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_ruta_id_fkey" FOREIGN KEY ("ruta_id") REFERENCES "rutas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_programada_por_id_fkey" FOREIGN KEY ("programada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_cambio_por_id_fkey" FOREIGN KEY ("cambio_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_iniciada_por_id_fkey" FOREIGN KEY ("iniciada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_finalizada_por_id_fkey" FOREIGN KEY ("finalizada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas_operativas" ADD CONSTRAINT "jornadas_operativas_jornada_anterior_id_fkey" FOREIGN KEY ("jornada_anterior_id") REFERENCES "jornadas_operativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_mantenimiento_preventivo" ADD CONSTRAINT "planes_mantenimiento_preventivo_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_mantenimiento_preventivo" ADD CONSTRAINT "planes_mantenimiento_preventivo_modelo_bus_id_fkey" FOREIGN KEY ("modelo_bus_id") REFERENCES "modelos_bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_mantenimiento_preventivo" ADD CONSTRAINT "planes_mantenimiento_preventivo_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidades_repuesto" ADD CONSTRAINT "compatibilidades_repuesto_repuesto_id_fkey" FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidades_repuesto" ADD CONSTRAINT "compatibilidades_repuesto_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidades_repuesto" ADD CONSTRAINT "compatibilidades_repuesto_modelo_bus_id_fkey" FOREIGN KEY ("modelo_bus_id") REFERENCES "modelos_bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidades_repuesto" ADD CONSTRAINT "compatibilidades_repuesto_definida_por_id_fkey" FOREIGN KEY ("definida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_internas" ADD CONSTRAINT "alertas_internas_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_internas" ADD CONSTRAINT "alertas_internas_jornada_operativa_id_fkey" FOREIGN KEY ("jornada_operativa_id") REFERENCES "jornadas_operativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_internas" ADD CONSTRAINT "alertas_internas_novedad_id_fkey" FOREIGN KEY ("novedad_id") REFERENCES "novedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_internas" ADD CONSTRAINT "alertas_internas_programacion_mantenimiento_id_fkey" FOREIGN KEY ("programacion_mantenimiento_id") REFERENCES "programaciones_mantenimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_internas" ADD CONSTRAINT "alertas_internas_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_internas" ADD CONSTRAINT "alertas_internas_repuesto_id_fkey" FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_destinatarios" ADD CONSTRAINT "alertas_destinatarios_alerta_interna_id_fkey" FOREIGN KEY ("alerta_interna_id") REFERENCES "alertas_internas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_destinatarios" ADD CONSTRAINT "alertas_destinatarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- SGMV: restricciones ADITIVAS del modelo objetivo (23 tablas).
-- Complemento SQL del schema Prisma. No modifica datos ni restricciones previas.
-- Los nombres de tablas pertenecen al schema actual de la migracion.
-- Las extensiones nullable en tablas existentes NO se convierten en legado por
-- defecto y NO obligan a los servicios RF-01..RF-06 anteriores a inventar datos.
-- Este archivo no implementa los flujos HTTP, autorizacion de sesion ni alertas.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

ALTER TABLE planes_mantenimiento_preventivo
  ADD CONSTRAINT ck_obj_plan_destino CHECK (num_nonnulls(bus_id, modelo_bus_id) = 1),
  ADD CONSTRAINT ck_obj_plan_version CHECK (version > 0),
  ADD CONSTRAINT ck_obj_plan_clave CHECK (length(btrim(clave_tarea)) > 0),
  ADD CONSTRAINT ck_obj_plan_intervalos CHECK (
    (criterio = 'FECHA' AND intervalo_dias IS NOT NULL AND intervalo_dias > 0 AND intervalo_km IS NULL)
    OR (criterio = 'KILOMETRAJE' AND intervalo_km IS NOT NULL AND intervalo_km > 0 AND intervalo_dias IS NULL)
    OR (criterio = 'FECHA_KILOMETRAJE' AND intervalo_dias IS NOT NULL AND intervalo_dias > 0
        AND intervalo_km IS NOT NULL AND intervalo_km > 0)
  ),
  ADD CONSTRAINT ck_obj_plan_anticipacion CHECK (
    (anticipacion_dias IS NULL OR (intervalo_dias IS NOT NULL AND anticipacion_dias >= 0 AND anticipacion_dias < intervalo_dias))
    AND (anticipacion_km IS NULL OR (intervalo_km IS NOT NULL AND anticipacion_km >= 0 AND anticipacion_km < intervalo_km))
  );

ALTER TABLE compatibilidades_repuesto
  ADD CONSTRAINT ck_obj_compatibilidad_destino CHECK (num_nonnulls(bus_id, modelo_bus_id) = 1),
  ADD CONSTRAINT ck_obj_compatibilidad_version CHECK (version > 0),
  ADD CONSTRAINT ck_obj_compatibilidad_evidencia CHECK (
    jsonb_typeof(especificaciones_validadas) = 'object' AND especificaciones_validadas <> '{}'::jsonb
  );

CREATE UNIQUE INDEX ux_obj_compatibilidad_bus_vigente
  ON compatibilidades_repuesto(repuesto_id, bus_id) WHERE vigente AND bus_id IS NOT NULL;
CREATE UNIQUE INDEX ux_obj_compatibilidad_modelo_vigente
  ON compatibilidades_repuesto(repuesto_id, modelo_bus_id) WHERE vigente AND modelo_bus_id IS NOT NULL;
CREATE UNIQUE INDEX ux_obj_programacion_plan_bus_activa
  ON programaciones_mantenimiento(plan_mantenimiento_preventivo_id, bus_id)
  WHERE activa AND plan_mantenimiento_preventivo_id IS NOT NULL;

ALTER TABLE jornadas_operativas
  ADD CONSTRAINT ck_obj_jornada_programada CHECK (inicio_programado < fin_programado),
  ADD CONSTRAINT ck_obj_jornada_real CHECK (
    fin_real IS NULL OR (inicio_real IS NOT NULL AND fin_real >= inicio_real)
  ),
  ADD CONSTRAINT ck_obj_jornada_anterior CHECK (jornada_anterior_id IS NULL OR jornada_anterior_id <> id),
  ADD CONSTRAINT ck_obj_jornada_estados CHECK (
    (estado = 'PROGRAMADA' AND inicio_real IS NULL AND fin_real IS NULL)
    OR (estado = 'EN_CURSO' AND inicio_real IS NOT NULL AND fin_real IS NULL)
    OR (estado = 'FINALIZADA' AND inicio_real IS NOT NULL AND fin_real IS NOT NULL)
    OR (estado IN ('CANCELADA', 'REASIGNADA') AND
        ((inicio_real IS NULL AND fin_real IS NULL) OR (inicio_real IS NOT NULL AND fin_real IS NOT NULL)))
  ),
  ADD CONSTRAINT ck_obj_jornada_responsables CHECK (
    ((inicio_real IS NULL AND iniciada_por_id IS NULL) OR (inicio_real IS NOT NULL AND iniciada_por_id IS NOT NULL))
    AND ((fin_real IS NULL AND finalizada_por_id IS NULL) OR (fin_real IS NOT NULL AND finalizada_por_id IS NOT NULL))
  ),
  ADD CONSTRAINT ck_obj_jornada_cambio CHECK (
    (num_nonnulls(cambio_por_id, fecha_cambio, motivo_cambio) = 0
      AND estado NOT IN ('CANCELADA', 'REASIGNADA'))
    OR (num_nonnulls(cambio_por_id, fecha_cambio, motivo_cambio) = 3 AND length(btrim(motivo_cambio)) > 0)
  );

-- Intervalos semiabiertos: dos turnos contiguos SI son validos.
-- Reserva cancelada/reemplazada conserva sus fechas, pero deja de reservar.
ALTER TABLE jornadas_operativas
  ADD CONSTRAINT ex_obj_jornada_bus_reserva EXCLUDE USING gist
    (bus_id WITH =, tstzrange(inicio_programado, fin_programado, '[)') WITH &&)
    WHERE (estado IN ('PROGRAMADA', 'EN_CURSO')) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT ex_obj_jornada_conductor_reserva EXCLUDE USING gist
    (conductor_id WITH =, tstzrange(inicio_programado, fin_programado, '[)') WITH &&)
    WHERE (estado IN ('PROGRAMADA', 'EN_CURSO')) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT ex_obj_jornada_bus_real EXCLUDE USING gist
    (bus_id WITH =, tstzrange(inicio_real, fin_real, '[)') WITH &&)
    WHERE (inicio_real IS NOT NULL) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT ex_obj_jornada_conductor_real EXCLUDE USING gist
    (conductor_id WITH =, tstzrange(inicio_real, fin_real, '[)') WITH &&)
    WHERE (inicio_real IS NOT NULL) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE lecturas_kilometraje
  ADD CONSTRAINT ck_obj_lectura_contexto CHECK (
    num_nonnulls(jornada_operativa_id, orden_trabajo_id, intervencion_id) = 0
    OR (tipo IS NOT NULL AND fecha_lectura IS NOT NULL)
  ),
  ADD CONSTRAINT ck_obj_lectura_fecha_tipo CHECK (tipo IS NULL OR fecha_lectura IS NOT NULL),
  ADD CONSTRAINT ck_obj_lectura_fecha_evento CHECK (fecha_lectura IS NULL OR fecha_lectura <= fecha_registro),
  ADD CONSTRAINT ck_obj_lectura_tipo_contexto CHECK (
    tipo IS NULL
    OR (tipo IN ('INICIO_JORNADA', 'FIN_JORNADA', 'NOVEDAD') AND jornada_operativa_id IS NOT NULL)
    OR (tipo IN ('INGRESO_TALLER', 'CIERRE_MANTENIMIENTO') AND orden_trabajo_id IS NOT NULL)
    OR (tipo = 'REVISION_TECNICA' AND intervencion_id IS NOT NULL AND orden_trabajo_id IS NOT NULL)
    OR (tipo = 'AJUSTE_ADMINISTRATIVO' AND motivo IS NOT NULL AND length(btrim(motivo)) > 0)
  ),
  ADD CONSTRAINT ck_obj_lectura_intervencion_orden CHECK (intervencion_id IS NULL OR orden_trabajo_id IS NOT NULL);

CREATE UNIQUE INDEX ux_obj_lectura_extremo_jornada
  ON lecturas_kilometraje(jornada_operativa_id, tipo)
  WHERE tipo IN ('INICIO_JORNADA', 'FIN_JORNADA');

ALTER TABLE novedades
  ADD CONSTRAINT ck_obj_novedad_fecha_evento CHECK (fecha_ocurrencia IS NULL OR fecha_ocurrencia <= fecha_reporte),
  ADD CONSTRAINT ck_obj_novedad_bloqueo CHECK (
    bloquea_disponibilidad IS DISTINCT FROM true OR afecta_operacion IS TRUE
  );

ALTER TABLE consumos_repuesto
  ADD CONSTRAINT ck_obj_consumo_compatibilidad CHECK ((
    (resultado_compatibilidad IS NULL AND
      num_nonnulls(intervencion_id, regla_compatibilidad_id, regla_version, evidencia_compatibilidad,
                    autorizado_por_id, fecha_autorizacion, motivo_excepcion) = 0)
    OR (resultado_compatibilidad = 'NO_EVALUADA_LEGADO' AND
      num_nonnulls(regla_compatibilidad_id, regla_version, evidencia_compatibilidad,
                    autorizado_por_id, fecha_autorizacion, motivo_excepcion) = 0)
    OR (resultado_compatibilidad = 'COMPATIBLE' AND intervencion_id IS NOT NULL
      AND regla_compatibilidad_id IS NOT NULL AND regla_version IS NOT NULL AND regla_version > 0
      AND evidencia_compatibilidad IS NOT NULL AND jsonb_typeof(evidencia_compatibilidad) = 'object'
      AND evidencia_compatibilidad <> '{}'::jsonb
      AND num_nonnulls(autorizado_por_id, fecha_autorizacion, motivo_excepcion) = 0)
    OR (resultado_compatibilidad = 'EXCEPCION_AUTORIZADA' AND intervencion_id IS NOT NULL
      AND evidencia_compatibilidad IS NOT NULL AND jsonb_typeof(evidencia_compatibilidad) = 'object'
      AND evidencia_compatibilidad <> '{}'::jsonb
      AND num_nonnulls(autorizado_por_id, fecha_autorizacion, motivo_excepcion) = 3
      AND length(btrim(motivo_excepcion)) > 0 AND fecha_autorizacion <= fecha_consumo
      AND ((regla_compatibilidad_id IS NULL AND regla_version IS NULL)
        OR (regla_compatibilidad_id IS NOT NULL AND regla_version IS NOT NULL AND regla_version > 0)))
  ) IS TRUE);

ALTER TABLE alertas_internas
  ADD CONSTRAINT ck_obj_alerta_origen CHECK (
    num_nonnulls(bus_id, jornada_operativa_id, novedad_id, programacion_mantenimiento_id, orden_trabajo_id, repuesto_id) = 1
  ),
  ADD CONSTRAINT ck_obj_alerta_clave CHECK (length(btrim(clave_deduplicacion)) > 0),
  ADD CONSTRAINT ck_obj_alerta_contexto CHECK (jsonb_typeof(contexto_evento) = 'object');

ALTER TABLE alertas_destinatarios
  ADD CONSTRAINT ck_obj_alerta_destinatario_fechas CHECK (
    (estado = 'NO_LEIDA' AND fecha_lectura IS NULL AND fecha_atencion IS NULL)
    OR (estado = 'LEIDA' AND fecha_lectura IS NOT NULL AND fecha_atencion IS NULL)
    OR (estado = 'ATENDIDA' AND fecha_lectura IS NOT NULL AND fecha_atencion IS NOT NULL
        AND fecha_atencion >= fecha_lectura)
  );

-- Autorias: se comprueba el rol en la accion nueva, no se revalida el historial
-- entero cuando una persona cambia de rol posteriormente.
CREATE FUNCTION sgmv_obj_exigir_rol(p_usuario uuid, p_codigos text[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_usuario IS NULL OR NOT EXISTS (
    SELECT 1 FROM usuarios u JOIN roles r ON r.id = u.rol_id
    WHERE u.id = p_usuario AND u.estado = 'ACTIVO' AND r.codigo::text = ANY(p_codigos)
  ) THEN
    RAISE EXCEPTION 'Actor inexistente/inactivo o rol no autorizado para la accion objetivo' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION sgmv_obj_guardar_jornada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_anterior jornadas_operativas%ROWTYPE;
BEGIN
  -- Serializa cambios de cadena; la unicidad de anterior evita bifurcaciones.
  PERFORM pg_advisory_xact_lock(hashtextextended('sgmv:cadena-jornada', 0));
  IF TG_OP = 'UPDATE' AND
    ROW(NEW.bus_id, NEW.conductor_id, NEW.ruta_id, NEW.inicio_programado, NEW.fin_programado, NEW.jornada_anterior_id)
      IS DISTINCT FROM ROW(OLD.bus_id, OLD.conductor_id, OLD.ruta_id, OLD.inicio_programado, OLD.fin_programado, OLD.jornada_anterior_id) THEN
    RAISE EXCEPTION 'La identidad/agenda de una jornada no se sobrescribe: crear sucesora' USING ERRCODE = '23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado AND NOT (
    (OLD.estado='PROGRAMADA' AND NEW.estado IN ('EN_CURSO', 'CANCELADA', 'REASIGNADA'))
    OR (OLD.estado='EN_CURSO' AND NEW.estado IN ('FINALIZADA', 'CANCELADA', 'REASIGNADA'))
  ) THEN
    RAISE EXCEPTION 'Transicion de jornada no permitida; los estados finales son terminales' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (
    (OLD.inicio_real IS NOT NULL AND ROW(NEW.inicio_real, NEW.iniciada_por_id) IS DISTINCT FROM ROW(OLD.inicio_real, OLD.iniciada_por_id))
    OR (OLD.fin_real IS NOT NULL AND ROW(NEW.fin_real, NEW.finalizada_por_id) IS DISTINCT FROM ROW(OLD.fin_real, OLD.finalizada_por_id))
  ) THEN
    RAISE EXCEPTION 'No se sobrescribe el inicio/final real ya registrado' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM sgmv_obj_exigir_rol(NEW.conductor_id, ARRAY['CONDUCTOR']);
    PERFORM sgmv_obj_exigir_rol(NEW.programada_por_id, ARRAY['ADMINISTRADOR', 'DESPACHADOR']);
  ELSIF NEW.programada_por_id IS DISTINCT FROM OLD.programada_por_id THEN
    RAISE EXCEPTION 'No se modifica la autoria inicial de la jornada' USING ERRCODE = '23514';
  END IF;
  IF NEW.jornada_anterior_id IS NOT NULL THEN
    SELECT * INTO v_anterior FROM jornadas_operativas WHERE id = NEW.jornada_anterior_id;
    IF NOT FOUND OR v_anterior.estado <> 'REASIGNADA' THEN
      RAISE EXCEPTION 'La anterior debe existir y estar reasignada' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      WITH RECURSIVE cadena AS (
        SELECT id, jornada_anterior_id, ARRAY[id] AS camino FROM jornadas_operativas WHERE id = NEW.jornada_anterior_id
        UNION ALL
        SELECT j.id, j.jornada_anterior_id, c.camino || j.id
        FROM jornadas_operativas j JOIN cadena c ON j.id = c.jornada_anterior_id
        WHERE NOT j.id = ANY(c.camino)
      ) SELECT 1 FROM cadena WHERE id = NEW.id OR jornada_anterior_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Ciclo de jornadas no permitido' USING ERRCODE = '23514';
    END IF;
    IF NEW.inicio_real IS NOT NULL AND v_anterior.fin_real IS NOT NULL AND NEW.inicio_real < v_anterior.fin_real THEN
      RAISE EXCEPTION 'La sucesora inicia antes de finalizar el tramo anterior' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.cambio_por_id IS NOT NULL AND (TG_OP = 'INSERT' OR
      ROW(NEW.cambio_por_id, NEW.fecha_cambio, NEW.motivo_cambio) IS DISTINCT FROM
      ROW(OLD.cambio_por_id, OLD.fecha_cambio, OLD.motivo_cambio)) THEN
    PERFORM sgmv_obj_exigir_rol(NEW.cambio_por_id, ARRAY['ADMINISTRADOR', 'DESPACHADOR']);
  END IF;
  IF NEW.inicio_real IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.inicio_real IS DISTINCT FROM OLD.inicio_real) THEN
    PERFORM sgmv_obj_exigir_rol(NEW.iniciada_por_id, ARRAY['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR']);
    IF NOT EXISTS (SELECT 1 FROM buses WHERE id = NEW.bus_id AND estado_operativo = 'OPERATIVO') THEN
      RAISE EXCEPTION 'No iniciar jornada con bus no operativo' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM usuarios u JOIN roles r ON r.id=u.rol_id
      WHERE u.id=NEW.iniciada_por_id AND r.codigo='CONDUCTOR' AND u.id<>NEW.conductor_id) THEN
      RAISE EXCEPTION 'El conductor solo inicia su jornada' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.fin_real IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.fin_real IS DISTINCT FROM OLD.fin_real) THEN
    PERFORM sgmv_obj_exigir_rol(NEW.finalizada_por_id, ARRAY['ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR']);
    IF EXISTS (SELECT 1 FROM usuarios u JOIN roles r ON r.id=u.rol_id
      WHERE u.id=NEW.finalizada_por_id AND r.codigo='CONDUCTOR' AND u.id<>NEW.conductor_id) THEN
      RAISE EXCEPTION 'El conductor solo finaliza su jornada' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_obj_jornada_guardar BEFORE INSERT OR UPDATE ON jornadas_operativas
  FOR EACH ROW EXECUTE FUNCTION sgmv_obj_guardar_jornada();

CREATE FUNCTION sgmv_obj_guardar_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM sgmv_obj_exigir_rol(NEW.creado_por_id, ARRAY['ADMINISTRADOR']);
  ELSIF ROW(NEW.id, NEW.clave_tarea, NEW.bus_id, NEW.modelo_bus_id, NEW.creado_por_id, NEW.created_at,
      NEW.version, NEW.componente, NEW.actividad, NEW.criterio, NEW.intervalo_dias, NEW.intervalo_km,
      NEW.anticipacion_dias, NEW.anticipacion_km, NEW.prioridad, NEW.bloquea_al_vencer)
    IS DISTINCT FROM ROW(OLD.id, OLD.clave_tarea, OLD.bus_id, OLD.modelo_bus_id, OLD.creado_por_id, OLD.created_at,
      OLD.version, OLD.componente, OLD.actividad, OLD.criterio, OLD.intervalo_dias, OLD.intervalo_km,
      OLD.anticipacion_dias, OLD.anticipacion_km, OLD.prioridad, OLD.bloquea_al_vencer) THEN
    RAISE EXCEPTION 'Conservar el plan aplicado: desactivar y crear una nueva version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_obj_plan_guardar BEFORE INSERT OR UPDATE ON planes_mantenimiento_preventivo
  FOR EACH ROW EXECUTE FUNCTION sgmv_obj_guardar_plan();

-- La unicidad cruza dos tablas; el candado usa bus+tarea, no planId, para
-- cubrir el plan de modelo y la regla particular del mismo trabajo.
CREATE FUNCTION sgmv_obj_obligacion_preventiva() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_plan planes_mantenimiento_preventivo%ROWTYPE; v_modelo uuid;
BEGIN
  IF NEW.plan_mantenimiento_preventivo_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO STRICT v_plan FROM planes_mantenimiento_preventivo WHERE id=NEW.plan_mantenimiento_preventivo_id;
  IF NEW.activa THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('sgmv:obligacion:' || NEW.bus_id::text || ':' || v_plan.clave_tarea, 0));
    SELECT modelo_bus_id INTO v_modelo FROM buses WHERE id=NEW.bus_id;
    IF (v_plan.bus_id IS NOT NULL AND v_plan.bus_id<>NEW.bus_id)
       OR (v_plan.modelo_bus_id IS NOT NULL AND v_plan.modelo_bus_id IS DISTINCT FROM v_modelo) THEN
      RAISE EXCEPTION 'El plan no aplica al bus de la programacion' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM programaciones_mantenimiento p
      JOIN planes_mantenimiento_preventivo pp ON pp.id=p.plan_mantenimiento_preventivo_id
      WHERE p.activa AND p.bus_id=NEW.bus_id AND p.id<>NEW.id AND pp.clave_tarea=v_plan.clave_tarea) THEN
      RAISE EXCEPTION 'Obligacion preventiva activa duplicada para bus y tarea' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_obj_obligacion_preventiva BEFORE INSERT OR UPDATE ON programaciones_mantenimiento
  FOR EACH ROW EXECUTE FUNCTION sgmv_obj_obligacion_preventiva();

CREATE FUNCTION sgmv_obj_guardar_compatibilidad() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sgmv:compatibilidad:' || NEW.repuesto_id::text, 0));
  IF TG_OP='INSERT' THEN
    PERFORM sgmv_obj_exigir_rol(NEW.definida_por_id, ARRAY['ADMINISTRADOR']);
  ELSIF ROW(NEW.repuesto_id, NEW.bus_id, NEW.modelo_bus_id, NEW.version, NEW.permitido,
      NEW.condicion_uso, NEW.especificaciones_validadas, NEW.definida_por_id, NEW.fecha_definicion)
      IS DISTINCT FROM ROW(OLD.repuesto_id, OLD.bus_id, OLD.modelo_bus_id, OLD.version, OLD.permitido,
      OLD.condicion_uso, OLD.especificaciones_validadas, OLD.definida_por_id, OLD.fecha_definicion) THEN
    RAISE EXCEPTION 'Conservar la regla tecnica: desactivar y crear una nueva version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_obj_compatibilidad_guardar BEFORE INSERT OR UPDATE ON compatibilidades_repuesto
  FOR EACH ROW EXECUTE FUNCTION sgmv_obj_guardar_compatibilidad();

CREATE FUNCTION sgmv_obj_assert_lectura(p_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE l lecturas_kilometraje%ROWTYPE; j jornadas_operativas%ROWTYPE;
  o ordenes_trabajo%ROWTYPE; i intervenciones%ROWTYPE; n novedades%ROWTYPE;
BEGIN
  SELECT * INTO l FROM lecturas_kilometraje WHERE id=p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF l.jornada_operativa_id IS NOT NULL THEN
    SELECT * INTO STRICT j FROM jornadas_operativas WHERE id=l.jornada_operativa_id;
    IF j.bus_id<>l.bus_id THEN RAISE EXCEPTION 'Lectura y jornada pertenecen a buses diferentes' USING ERRCODE='23514'; END IF;
    IF l.tipo='INICIO_JORNADA' AND (j.inicio_real IS NULL OR l.fecha_lectura<>j.inicio_real) THEN
      RAISE EXCEPTION 'Lectura inicial no coincide con inicio real' USING ERRCODE='23514';
    END IF;
    IF l.tipo='FIN_JORNADA' AND (j.fin_real IS NULL OR l.fecha_lectura<>j.fin_real) THEN
      RAISE EXCEPTION 'Lectura final no coincide con fin real' USING ERRCODE='23514';
    END IF;
  END IF;
  IF l.orden_trabajo_id IS NOT NULL THEN
    SELECT * INTO STRICT o FROM ordenes_trabajo WHERE id=l.orden_trabajo_id;
    IF o.bus_id<>l.bus_id OR (l.jornada_operativa_id IS NOT NULL AND o.jornada_operativa_id IS NOT NULL
        AND l.jornada_operativa_id<>o.jornada_operativa_id) THEN
      RAISE EXCEPTION 'Contexto de lectura no coincide con orden' USING ERRCODE='23514';
    END IF;
  END IF;
  IF l.intervencion_id IS NOT NULL THEN
    SELECT * INTO STRICT i FROM intervenciones WHERE id=l.intervencion_id;
    IF i.orden_trabajo_id IS DISTINCT FROM l.orden_trabajo_id THEN
      RAISE EXCEPTION 'Lectura e intervencion pertenecen a ordenes diferentes' USING ERRCODE='23514';
    END IF;
  END IF;
  SELECT * INTO n FROM novedades WHERE lectura_kilometraje_id=l.id;
  IF FOUND THEN
    IF l.tipo IS DISTINCT FROM 'NOVEDAD'::tipo_lectura OR n.bus_id<>l.bus_id
       OR n.jornada_operativa_id IS DISTINCT FROM l.jornada_operativa_id
       OR n.fecha_ocurrencia IS DISTINCT FROM l.fecha_lectura THEN
      RAISE EXCEPTION 'La lectura no corresponde a la novedad' USING ERRCODE='23514';
    END IF;
  ELSIF l.tipo='NOVEDAD' THEN
    RAISE EXCEPTION 'La lectura de novedad debe tener su novedad al confirmar' USING ERRCODE='23514';
  END IF;
END;
$$;

CREATE FUNCTION sgmv_obj_assert_jornada(p_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE j jornadas_operativas%ROWTYPE; km_ini integer; km_fin integer; v_id uuid;
BEGIN
  SELECT * INTO j FROM jornadas_operativas WHERE id=p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF j.inicio_real IS NOT NULL THEN
    SELECT kilometraje_nuevo INTO km_ini FROM lecturas_kilometraje WHERE jornada_operativa_id=j.id AND tipo='INICIO_JORNADA';
    IF NOT FOUND THEN RAISE EXCEPTION 'Jornada iniciada sin lectura inicial' USING ERRCODE='23514'; END IF;
  END IF;
  IF j.fin_real IS NOT NULL THEN
    SELECT kilometraje_nuevo INTO km_fin FROM lecturas_kilometraje WHERE jornada_operativa_id=j.id AND tipo='FIN_JORNADA';
    IF NOT FOUND OR km_fin<km_ini THEN RAISE EXCEPTION 'Jornada finalizada sin lectura final coherente' USING ERRCODE='23514'; END IF;
  END IF;
  IF j.estado='REASIGNADA' AND NOT EXISTS (SELECT 1 FROM jornadas_operativas WHERE jornada_anterior_id=j.id) THEN
    RAISE EXCEPTION 'Jornada reasignada sin sucesora al confirmar' USING ERRCODE='23514';
  END IF;
  FOR v_id IN SELECT id FROM lecturas_kilometraje WHERE jornada_operativa_id=j.id LOOP
    PERFORM sgmv_obj_assert_lectura(v_id);
  END LOOP;
END;
$$;

CREATE FUNCTION sgmv_obj_contextos_diferidos() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_intervencion uuid; n novedades%ROWTYPE; j jornadas_operativas%ROWTYPE; o ordenes_trabajo%ROWTYPE;
BEGIN
  v_id := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  IF TG_TABLE_NAME='lecturas_kilometraje' THEN
    IF TG_OP<>'DELETE' THEN PERFORM sgmv_obj_assert_lectura(v_id); END IF;
    IF TG_OP<>'INSERT' AND OLD.jornada_operativa_id IS NOT NULL THEN PERFORM sgmv_obj_assert_jornada(OLD.jornada_operativa_id); END IF;
    IF TG_OP<>'DELETE' AND NEW.jornada_operativa_id IS NOT NULL THEN PERFORM sgmv_obj_assert_jornada(NEW.jornada_operativa_id); END IF;
  ELSIF TG_TABLE_NAME='jornadas_operativas' THEN
    PERFORM sgmv_obj_assert_jornada(v_id);
    IF TG_OP<>'INSERT' AND OLD.jornada_anterior_id IS NOT NULL THEN PERFORM sgmv_obj_assert_jornada(OLD.jornada_anterior_id); END IF;
    IF TG_OP<>'DELETE' AND NEW.jornada_anterior_id IS NOT NULL THEN PERFORM sgmv_obj_assert_jornada(NEW.jornada_anterior_id); END IF;
  ELSIF TG_TABLE_NAME='novedades' THEN
    SELECT * INTO n FROM novedades WHERE id=v_id;
    IF FOUND THEN
      IF n.jornada_operativa_id IS NOT NULL OR n.lectura_kilometraje_id IS NOT NULL THEN
        IF n.jornada_operativa_id IS NULL OR n.lectura_kilometraje_id IS NULL OR n.fecha_ocurrencia IS NULL THEN
          RAISE EXCEPTION 'Contexto de novedad incompleto al confirmar' USING ERRCODE='23514';
        END IF;
        SELECT * INTO STRICT j FROM jornadas_operativas WHERE id=n.jornada_operativa_id;
        IF n.bus_id<>j.bus_id OR n.conductor_id<>j.conductor_id THEN
          RAISE EXCEPTION 'Novedad no corresponde al bus/conductor de la jornada' USING ERRCODE='23514';
        END IF;
        PERFORM sgmv_obj_assert_lectura(n.lectura_kilometraje_id);
      END IF;
      IF EXISTS (SELECT 1 FROM ordenes_trabajo oo WHERE oo.novedad_id=n.id
        AND n.jornada_operativa_id IS NOT NULL AND oo.jornada_operativa_id IS DISTINCT FROM n.jornada_operativa_id) THEN
        RAISE EXCEPTION 'Orden de novedad con jornada diferente' USING ERRCODE='23514';
      END IF;
    END IF;
    IF TG_OP<>'INSERT' AND OLD.lectura_kilometraje_id IS NOT NULL THEN PERFORM sgmv_obj_assert_lectura(OLD.lectura_kilometraje_id); END IF;
  ELSIF TG_TABLE_NAME='ordenes_trabajo' THEN
    SELECT * INTO o FROM ordenes_trabajo WHERE id=v_id;
    IF FOUND THEN
      IF o.jornada_operativa_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM jornadas_operativas WHERE id=o.jornada_operativa_id AND bus_id=o.bus_id) THEN
        RAISE EXCEPTION 'Orden y jornada pertenecen a buses diferentes' USING ERRCODE='23514';
      END IF;
      IF o.novedad_id IS NOT NULL AND EXISTS (SELECT 1 FROM novedades nn WHERE nn.id=o.novedad_id
          AND nn.jornada_operativa_id IS NOT NULL AND nn.jornada_operativa_id IS DISTINCT FROM o.jornada_operativa_id) THEN
        RAISE EXCEPTION 'Orden no conserva jornada de la novedad' USING ERRCODE='23514';
      END IF;
      FOR v_id IN SELECT id FROM lecturas_kilometraje WHERE orden_trabajo_id=o.id LOOP PERFORM sgmv_obj_assert_lectura(v_id); END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME='intervenciones' THEN
    v_intervencion:=v_id;
    FOR v_id IN SELECT id FROM lecturas_kilometraje WHERE intervencion_id=v_intervencion LOOP PERFORM sgmv_obj_assert_lectura(v_id); END LOOP;
    IF EXISTS (SELECT 1 FROM consumos_repuesto c JOIN intervenciones i ON i.id=c.intervencion_id
      WHERE i.id=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END AND i.orden_trabajo_id<>c.orden_trabajo_id) THEN
      RAISE EXCEPTION 'Consumo e intervencion pertenecen a ordenes diferentes' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER tr_obj_contexto_lectura AFTER INSERT OR UPDATE OR DELETE ON lecturas_kilometraje
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgmv_obj_contextos_diferidos();
CREATE CONSTRAINT TRIGGER tr_obj_contexto_jornada AFTER INSERT OR UPDATE OR DELETE ON jornadas_operativas
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgmv_obj_contextos_diferidos();
CREATE CONSTRAINT TRIGGER tr_obj_contexto_novedad AFTER INSERT OR UPDATE OR DELETE ON novedades
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgmv_obj_contextos_diferidos();
CREATE CONSTRAINT TRIGGER tr_obj_contexto_orden AFTER INSERT OR UPDATE ON ordenes_trabajo
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgmv_obj_contextos_diferidos();
CREATE CONSTRAINT TRIGGER tr_obj_contexto_intervencion AFTER UPDATE ON intervenciones
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgmv_obj_contextos_diferidos();

CREATE FUNCTION sgmv_obj_guardar_consumo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i intervenciones%ROWTYPE; c compatibilidades_repuesto%ROWTYPE; o ordenes_trabajo%ROWTYPE;
  v_bus uuid; v_modelo uuid;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.intervencion_id, NEW.regla_compatibilidad_id, NEW.resultado_compatibilidad,
      NEW.regla_version, NEW.evidencia_compatibilidad, NEW.autorizado_por_id, NEW.fecha_autorizacion,
      NEW.motivo_excepcion, NEW.orden_trabajo_id, NEW.repuesto_id, NEW.consumido_por_id)
    IS NOT DISTINCT FROM ROW(OLD.intervencion_id, OLD.regla_compatibilidad_id, OLD.resultado_compatibilidad,
      OLD.regla_version, OLD.evidencia_compatibilidad, OLD.autorizado_por_id, OLD.fecha_autorizacion,
      OLD.motivo_excepcion, OLD.orden_trabajo_id, OLD.repuesto_id, OLD.consumido_por_id) THEN RETURN NEW; END IF;
  IF NEW.resultado_compatibilidad IS NULL THEN RETURN NEW; END IF;
  IF NEW.resultado_compatibilidad='NO_EVALUADA_LEGADO' THEN
    IF TG_OP='INSERT' THEN RAISE EXCEPTION 'No se etiquetan consumos nuevos como legado' USING ERRCODE='23514'; END IF;
    IF NEW.intervencion_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM intervenciones
      WHERE id=NEW.intervencion_id AND orden_trabajo_id=NEW.orden_trabajo_id) THEN
      RAISE EXCEPTION 'La intervencion historica no corresponde a la orden' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM sgmv_obj_exigir_rol(NEW.consumido_por_id, ARRAY['MECANICO']);
  -- Orden antes de intervencion: mismo orden de bloqueo que la ejecucion tecnica.
  SELECT * INTO STRICT o FROM ordenes_trabajo WHERE id=NEW.orden_trabajo_id FOR UPDATE;
  IF o.estado<>'EN_EJECUCION' OR o.tecnico_asignado_id IS DISTINCT FROM NEW.consumido_por_id THEN
    RAISE EXCEPTION 'La orden no esta en ejecucion por el mecanico consumidor' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT i FROM intervenciones WHERE id=NEW.intervencion_id FOR SHARE;
  IF i.orden_trabajo_id<>NEW.orden_trabajo_id OR i.tecnico_id<>NEW.consumido_por_id OR i.fecha_fin IS NOT NULL THEN
    RAISE EXCEPTION 'El consumo nuevo requiere intervencion activa propia de la misma orden' USING ERRCODE='23514';
  END IF;
  v_bus:=o.bus_id;
  SELECT modelo_bus_id INTO v_modelo FROM buses WHERE id=v_bus FOR SHARE;
  PERFORM pg_advisory_xact_lock(hashtextextended('sgmv:compatibilidad:' || NEW.repuesto_id::text, 0));
  IF NEW.regla_compatibilidad_id IS NOT NULL THEN
    SELECT * INTO STRICT c FROM compatibilidades_repuesto WHERE id=NEW.regla_compatibilidad_id FOR SHARE;
    IF c.repuesto_id<>NEW.repuesto_id OR c.version IS DISTINCT FROM NEW.regla_version
      OR (c.bus_id IS NOT NULL AND c.bus_id<>v_bus)
      OR (c.modelo_bus_id IS NOT NULL AND c.modelo_bus_id IS DISTINCT FROM v_modelo) THEN
      RAISE EXCEPTION 'La regla aplicada no corresponde al repuesto/version/bus' USING ERRCODE='23514';
    END IF;
    IF NEW.resultado_compatibilidad='COMPATIBLE' AND (NOT c.vigente OR NOT c.permitido) THEN
      RAISE EXCEPTION 'La compatibilidad debe ser positiva y vigente al consumir' USING ERRCODE='23514';
    END IF;
    IF NEW.resultado_compatibilidad='COMPATIBLE' AND c.modelo_bus_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM compatibilidades_repuesto cc WHERE cc.repuesto_id=NEW.repuesto_id AND cc.bus_id=v_bus AND cc.vigente) THEN
      RAISE EXCEPTION 'La regla especifica de bus prevalece sobre el modelo' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.resultado_compatibilidad='EXCEPCION_AUTORIZADA' THEN
    PERFORM sgmv_obj_exigir_rol(NEW.autorizado_por_id, ARRAY['ADMINISTRADOR']);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_obj_consumo_guardar BEFORE INSERT OR UPDATE OF intervencion_id, regla_compatibilidad_id,
  resultado_compatibilidad, regla_version, evidencia_compatibilidad, autorizado_por_id, fecha_autorizacion,
  motivo_excepcion, orden_trabajo_id, repuesto_id, consumido_por_id ON consumos_repuesto
  FOR EACH ROW EXECUTE FUNCTION sgmv_obj_guardar_consumo();

CREATE FUNCTION sgmv_obj_alerta_destinatarios() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids uuid[]; v_id uuid; v_fecha timestamptz;
BEGIN
  IF TG_TABLE_NAME='alertas_internas' THEN
    ids:=ARRAY[CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END];
  ELSE
    ids:=ARRAY_REMOVE(ARRAY[
      CASE WHEN TG_OP<>'INSERT' THEN OLD.alerta_interna_id END,
      CASE WHEN TG_OP<>'DELETE' THEN NEW.alerta_interna_id END], NULL);
  END IF;
  FOR v_id IN SELECT DISTINCT unnest(ids) ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('sgmv:alerta:' || v_id::text, 0));
    SELECT fecha_generacion INTO v_fecha FROM alertas_internas WHERE id=v_id;
    IF FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM alertas_destinatarios WHERE alerta_interna_id=v_id) THEN
        RAISE EXCEPTION 'Toda alerta confirmada requiere al menos un destinatario' USING ERRCODE='23514';
      END IF;
      IF EXISTS (SELECT 1 FROM alertas_destinatarios WHERE alerta_interna_id=v_id
          AND (fecha_lectura<v_fecha OR fecha_atencion<v_fecha)) THEN
        RAISE EXCEPTION 'La lectura/atencion precede a la generacion de la alerta' USING ERRCODE='23514';
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER tr_obj_alerta_receptores AFTER INSERT OR UPDATE ON alertas_internas
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgmv_obj_alerta_destinatarios();
CREATE CONSTRAINT TRIGGER tr_obj_destinatarios_minimo AFTER INSERT OR UPDATE OR DELETE ON alertas_destinatarios
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgmv_obj_alerta_destinatarios();

-- Congela el schema de busqueda de estas funciones en el schema de la migracion.
-- Evita que pruebas en schemas aislados lean accidentalmente las tablas public.
DO $$
DECLARE v_schema text:=current_schema(); v_firma text;
BEGIN
  FOREACH v_firma IN ARRAY ARRAY[
    'sgmv_obj_exigir_rol(uuid,text[])', 'sgmv_obj_guardar_jornada()', 'sgmv_obj_guardar_plan()',
    'sgmv_obj_obligacion_preventiva()', 'sgmv_obj_guardar_compatibilidad()',
    'sgmv_obj_assert_lectura(uuid)', 'sgmv_obj_assert_jornada(uuid)',
    'sgmv_obj_contextos_diferidos()', 'sgmv_obj_guardar_consumo()', 'sgmv_obj_alerta_destinatarios()'
  ] LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = %I, pg_catalog', v_firma, v_schema);
  END LOOP;
END;
$$;

-- ENFORCEMENT QUE PERMANECE EN SERVICIOS / SIGUIENTE CORTE:
-- 1) Autorizar la sesion real (un FK actor valido no prueba quien ejecuta SQL),
--    filtrar DTO por rol y no exponer costos/diagnosticos a conductor/despachador.
-- 2) Exigir contexto completo en los nuevos endpoints; los anteriores conservan
--    su contrato temporal y campos objetivo nulos, SIN declararlos legado falso.
-- 3) Validar secuencia del odometro por fecha_lectura y vecinas; conservar base
--    historica. Actualizar kilometraje_actual materializado atomicamente, nunca
--    reducirlo por una lectura tardia. No fabricar fecha/tipo/modelo/contexto.
-- 4) Disponibilidad completa: novedades bloqueantes, preventivos criticos y otras
--    ordenes. La guarda SQL comprueba estado del bus y rangos, no la politica total.
-- 5) Lock transaccional comun por bus/orden/repuesto antes de decidir disponibilidad,
--    intervalos, stock y compatibilidad; evita TOCTOU entre cambios administrativos
--    y consumo/despacho. Los indices/exclusiones protegen sus conflictos locales.
-- 6) Recalculo preventivo idempotente tras cierre administrativo, snapshot del plan,
--    version/objetivos aplicados y regla de precedencia tarea particular/modelo.
--    Politica de anticipacion: ausente o 0 <= anticipacion < intervalo aplicable.
--    Cada cambio tecnico de plan crea otra fila/version; no reescribe la aplicada.
-- 7) Crear/bloquear/desactivar nuevas versiones de reglas mediante servicio; nunca
--    reinterpretar consumos historicos. La evidencia JSON requiere validacion de
--    contenido, unidades y campos, ademas del CHECK de objeto no vacio.
-- 8) Generar alertas con destinatarios autorizados y clave de ocurrencia/ciclo,
--    no tipo+origen permanente. Leer/atender no libera un bus. No mensajes externos.
-- 9) Mantener los triggers/constraints vigentes de stock, consumo-movimiento,
--    costos, estados de orden e idempotencia. Este archivo no los reemplaza.
-- 10) Inmutabilidad historica y rectificaciones auditadas se exponen exclusivamente
--     mediante acciones del dominio; no autorizar eliminacion fisica por interfaz.


COMMIT;
