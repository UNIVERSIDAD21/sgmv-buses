-- CreateEnum
CREATE TYPE "rol_codigo" AS ENUM ('ADMIN_SUPERVISOR', 'MECANICO', 'CONDUCTOR_OPERADOR');

-- CreateEnum
CREATE TYPE "estado_usuario" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "estado_bus" AS ENUM ('OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "estado_novedad" AS ENUM ('PENDIENTE_REVISION', 'RESUELTA_SIN_ORDEN', 'DESCARTADA', 'CONVERTIDA_A_ORDEN');

-- CreateEnum
CREATE TYPE "criterio_mantenimiento" AS ENUM ('FECHA', 'KILOMETRAJE', 'FECHA_KILOMETRAJE');

-- CreateEnum
CREATE TYPE "tipo_orden_trabajo" AS ENUM ('PREVENTIVA', 'CORRECTIVA');

-- CreateEnum
CREATE TYPE "origen_orden_trabajo" AS ENUM ('PREVENTIVO', 'CORRECTIVO_DIRECTO', 'NOVEDAD');

-- CreateEnum
CREATE TYPE "prioridad_orden" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "estado_orden_trabajo" AS ENUM ('PENDIENTE_ASIGNACION', 'ASIGNADA', 'EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION', 'CERRADA');

-- CreateEnum
CREATE TYPE "estado_repuesto" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "tipo_movimiento_inventario" AS ENUM ('ENTRADA', 'CONSUMO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "codigo" "rol_codigo" NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "telefono" VARCHAR(40),
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "estado" "estado_usuario" NOT NULL DEFAULT 'ACTIVO',
    "rol_id" UUID NOT NULL,
    "intentos_fallidos_login" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "ultimo_acceso_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buses" (
    "id" UUID NOT NULL,
    "codigo_interno" VARCHAR(60) NOT NULL,
    "placa" VARCHAR(20) NOT NULL,
    "marca" VARCHAR(100) NOT NULL,
    "modelo" VARCHAR(100) NOT NULL,
    "anio" INTEGER NOT NULL,
    "kilometraje_actual" INTEGER NOT NULL DEFAULT 0,
    "estado_operativo" "estado_bus" NOT NULL DEFAULT 'OPERATIVO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "buses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturas_kilometraje" (
    "id" UUID NOT NULL,
    "bus_id" UUID NOT NULL,
    "kilometraje_anterior" INTEGER NOT NULL,
    "kilometraje_nuevo" INTEGER NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,

    CONSTRAINT "lecturas_kilometraje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bus_estado_historial" (
    "id" UUID NOT NULL,
    "bus_id" UUID NOT NULL,
    "estado_anterior" "estado_bus",
    "estado_nuevo" "estado_bus" NOT NULL,
    "cambiado_por_id" UUID NOT NULL,
    "fecha_cambio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,

    CONSTRAINT "bus_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_conductor" (
    "id" UUID NOT NULL,
    "conductor_id" UUID NOT NULL,
    "bus_id" UUID NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMPTZ(6),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "asignado_por_id" UUID NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asignaciones_conductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novedades" (
    "id" UUID NOT NULL,
    "conductor_id" UUID NOT NULL,
    "bus_id" UUID NOT NULL,
    "fecha_reporte" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" VARCHAR(120) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "clasificacion" VARCHAR(120),
    "estado" "estado_novedad" NOT NULL DEFAULT 'PENDIENTE_REVISION',
    "revisada_por_id" UUID,
    "fecha_revision" TIMESTAMPTZ(6),
    "observacion_revision" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "novedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programaciones_mantenimiento" (
    "id" UUID NOT NULL,
    "bus_id" UUID NOT NULL,
    "tipo" VARCHAR(120) NOT NULL,
    "actividad" TEXT NOT NULL,
    "criterio" "criterio_mantenimiento" NOT NULL,
    "fecha_programada" DATE,
    "kilometraje_objetivo" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creada_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "programaciones_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "bus_id" UUID NOT NULL,
    "tipo" "tipo_orden_trabajo" NOT NULL,
    "origen" "origen_orden_trabajo" NOT NULL,
    "prioridad" "prioridad_orden" NOT NULL DEFAULT 'MEDIA',
    "descripcion" TEXT NOT NULL,
    "estado" "estado_orden_trabajo" NOT NULL DEFAULT 'PENDIENTE_ASIGNACION',
    "tecnico_asignado_id" UUID,
    "creada_por_id" UUID NOT NULL,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_asignacion" TIMESTAMPTZ(6),
    "fecha_inicio_ejecucion" TIMESTAMPTZ(6),
    "fecha_completada_tecnico" TIMESTAMPTZ(6),
    "fecha_cierre" TIMESTAMPTZ(6),
    "cerrada_por_id" UUID,
    "novedad_id" UUID,
    "programacion_mantenimiento_id" UUID,
    "fecha_objetivo_preventivo" DATE,
    "kilometraje_objetivo_preventivo" INTEGER,
    "costo_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervenciones" (
    "id" UUID NOT NULL,
    "orden_trabajo_id" UUID NOT NULL,
    "tecnico_id" UUID NOT NULL,
    "fecha_inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMPTZ(6),
    "diagnostico" TEXT,
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intervenciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades_orden" (
    "id" UUID NOT NULL,
    "intervencion_id" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrada_por_id" UUID NOT NULL,

    CONSTRAINT "actividades_orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_estado_historial" (
    "id" UUID NOT NULL,
    "orden_trabajo_id" UUID NOT NULL,
    "estado_anterior" "estado_orden_trabajo",
    "estado_nuevo" "estado_orden_trabajo" NOT NULL,
    "cambiado_por_id" UUID NOT NULL,
    "fecha_cambio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,

    CONSTRAINT "orden_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_reasignaciones" (
    "id" UUID NOT NULL,
    "orden_trabajo_id" UUID NOT NULL,
    "tecnico_anterior_id" UUID,
    "tecnico_nuevo_id" UUID NOT NULL,
    "reasignado_por_id" UUID NOT NULL,
    "fecha_reasignacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,

    CONSTRAINT "orden_reasignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repuestos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "categoria" VARCHAR(120),
    "unidad_medida" VARCHAR(40) NOT NULL,
    "stock_actual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_unitario" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "estado_repuesto" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "repuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumos_repuesto" (
    "id" UUID NOT NULL,
    "orden_trabajo_id" UUID NOT NULL,
    "repuesto_id" UUID NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "consumido_por_id" UUID NOT NULL,
    "fecha_consumo" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumos_repuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL,
    "repuesto_id" UUID NOT NULL,
    "tipo" "tipo_movimiento_inventario" NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "costo_unitario" DECIMAL(12,2),
    "motivo" TEXT,
    "responsable_id" UUID NOT NULL,
    "consumo_repuesto_id" UUID,
    "fecha_movimiento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_id_idx" ON "usuarios"("rol_id");

-- CreateIndex
CREATE INDEX "usuarios_estado_idx" ON "usuarios"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "buses_codigo_interno_key" ON "buses"("codigo_interno");

-- CreateIndex
CREATE UNIQUE INDEX "buses_placa_key" ON "buses"("placa");

-- CreateIndex
CREATE INDEX "buses_estado_operativo_idx" ON "buses"("estado_operativo");

-- CreateIndex
CREATE INDEX "lecturas_kilometraje_bus_id_fecha_registro_idx" ON "lecturas_kilometraje"("bus_id", "fecha_registro");

-- CreateIndex
CREATE INDEX "lecturas_kilometraje_registrado_por_id_idx" ON "lecturas_kilometraje"("registrado_por_id");

-- CreateIndex
CREATE INDEX "bus_estado_historial_bus_id_fecha_cambio_idx" ON "bus_estado_historial"("bus_id", "fecha_cambio");

-- CreateIndex
CREATE INDEX "bus_estado_historial_cambiado_por_id_idx" ON "bus_estado_historial"("cambiado_por_id");

-- CreateIndex
CREATE INDEX "asignaciones_conductor_bus_id_idx" ON "asignaciones_conductor"("bus_id");

-- CreateIndex
CREATE INDEX "asignaciones_conductor_conductor_id_idx" ON "asignaciones_conductor"("conductor_id");

-- CreateIndex
CREATE INDEX "asignaciones_conductor_asignado_por_id_idx" ON "asignaciones_conductor"("asignado_por_id");

-- CreateIndex
CREATE INDEX "novedades_bus_id_fecha_reporte_idx" ON "novedades"("bus_id", "fecha_reporte");

-- CreateIndex
CREATE INDEX "novedades_conductor_id_fecha_reporte_idx" ON "novedades"("conductor_id", "fecha_reporte");

-- CreateIndex
CREATE INDEX "novedades_estado_idx" ON "novedades"("estado");

-- CreateIndex
CREATE INDEX "novedades_revisada_por_id_idx" ON "novedades"("revisada_por_id");

-- CreateIndex
CREATE INDEX "programaciones_mantenimiento_bus_id_activa_idx" ON "programaciones_mantenimiento"("bus_id", "activa");

-- CreateIndex
CREATE INDEX "programaciones_mantenimiento_creada_por_id_idx" ON "programaciones_mantenimiento"("creada_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_codigo_key" ON "ordenes_trabajo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_novedad_id_key" ON "ordenes_trabajo"("novedad_id");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_bus_id_estado_idx" ON "ordenes_trabajo"("bus_id", "estado");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_cerrada_por_id_idx" ON "ordenes_trabajo"("cerrada_por_id");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_creada_por_id_idx" ON "ordenes_trabajo"("creada_por_id");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_programacion_mantenimiento_id_estado_idx" ON "ordenes_trabajo"("programacion_mantenimiento_id", "estado");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_tecnico_asignado_id_estado_idx" ON "ordenes_trabajo"("tecnico_asignado_id", "estado");

-- CreateIndex
CREATE INDEX "intervenciones_orden_trabajo_id_idx" ON "intervenciones"("orden_trabajo_id");

-- CreateIndex
CREATE INDEX "intervenciones_tecnico_id_idx" ON "intervenciones"("tecnico_id");

-- CreateIndex
CREATE INDEX "actividades_orden_intervencion_id_fecha_registro_idx" ON "actividades_orden"("intervencion_id", "fecha_registro");

-- CreateIndex
CREATE INDEX "actividades_orden_registrada_por_id_idx" ON "actividades_orden"("registrada_por_id");

-- CreateIndex
CREATE INDEX "orden_estado_historial_cambiado_por_id_idx" ON "orden_estado_historial"("cambiado_por_id");

-- CreateIndex
CREATE INDEX "orden_estado_historial_orden_trabajo_id_fecha_cambio_idx" ON "orden_estado_historial"("orden_trabajo_id", "fecha_cambio");

-- CreateIndex
CREATE INDEX "orden_reasignaciones_orden_trabajo_id_fecha_reasignacion_idx" ON "orden_reasignaciones"("orden_trabajo_id", "fecha_reasignacion");

-- CreateIndex
CREATE INDEX "orden_reasignaciones_reasignado_por_id_idx" ON "orden_reasignaciones"("reasignado_por_id");

-- CreateIndex
CREATE INDEX "orden_reasignaciones_tecnico_anterior_id_idx" ON "orden_reasignaciones"("tecnico_anterior_id");

-- CreateIndex
CREATE INDEX "orden_reasignaciones_tecnico_nuevo_id_idx" ON "orden_reasignaciones"("tecnico_nuevo_id");

-- CreateIndex
CREATE UNIQUE INDEX "repuestos_codigo_key" ON "repuestos"("codigo");

-- CreateIndex
CREATE INDEX "repuestos_estado_idx" ON "repuestos"("estado");

-- CreateIndex
CREATE INDEX "consumos_repuesto_consumido_por_id_idx" ON "consumos_repuesto"("consumido_por_id");

-- CreateIndex
CREATE INDEX "consumos_repuesto_orden_trabajo_id_idx" ON "consumos_repuesto"("orden_trabajo_id");

-- CreateIndex
CREATE INDEX "consumos_repuesto_repuesto_id_idx" ON "consumos_repuesto"("repuesto_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_inventario_consumo_repuesto_id_key" ON "movimientos_inventario"("consumo_repuesto_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_fecha_movimiento_idx" ON "movimientos_inventario"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_inventario_repuesto_id_fecha_movimiento_idx" ON "movimientos_inventario"("repuesto_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_inventario_responsable_id_idx" ON "movimientos_inventario"("responsable_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_kilometraje" ADD CONSTRAINT "lecturas_kilometraje_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_kilometraje" ADD CONSTRAINT "lecturas_kilometraje_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_estado_historial" ADD CONSTRAINT "bus_estado_historial_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_estado_historial" ADD CONSTRAINT "bus_estado_historial_cambiado_por_id_fkey" FOREIGN KEY ("cambiado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_conductor" ADD CONSTRAINT "asignaciones_conductor_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_conductor" ADD CONSTRAINT "asignaciones_conductor_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_conductor" ADD CONSTRAINT "asignaciones_conductor_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_revisada_por_id_fkey" FOREIGN KEY ("revisada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programaciones_mantenimiento" ADD CONSTRAINT "programaciones_mantenimiento_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programaciones_mantenimiento" ADD CONSTRAINT "programaciones_mantenimiento_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_cerrada_por_id_fkey" FOREIGN KEY ("cerrada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_novedad_id_fkey" FOREIGN KEY ("novedad_id") REFERENCES "novedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_programacion_mantenimiento_id_fkey" FOREIGN KEY ("programacion_mantenimiento_id") REFERENCES "programaciones_mantenimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_tecnico_asignado_id_fkey" FOREIGN KEY ("tecnico_asignado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades_orden" ADD CONSTRAINT "actividades_orden_intervencion_id_fkey" FOREIGN KEY ("intervencion_id") REFERENCES "intervenciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades_orden" ADD CONSTRAINT "actividades_orden_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_estado_historial" ADD CONSTRAINT "orden_estado_historial_cambiado_por_id_fkey" FOREIGN KEY ("cambiado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_estado_historial" ADD CONSTRAINT "orden_estado_historial_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_reasignaciones" ADD CONSTRAINT "orden_reasignaciones_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_reasignaciones" ADD CONSTRAINT "orden_reasignaciones_reasignado_por_id_fkey" FOREIGN KEY ("reasignado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_reasignaciones" ADD CONSTRAINT "orden_reasignaciones_tecnico_anterior_id_fkey" FOREIGN KEY ("tecnico_anterior_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_reasignaciones" ADD CONSTRAINT "orden_reasignaciones_tecnico_nuevo_id_fkey" FOREIGN KEY ("tecnico_nuevo_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_repuesto" ADD CONSTRAINT "consumos_repuesto_consumido_por_id_fkey" FOREIGN KEY ("consumido_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_repuesto" ADD CONSTRAINT "consumos_repuesto_orden_trabajo_id_fkey" FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_repuesto" ADD CONSTRAINT "consumos_repuesto_repuesto_id_fkey" FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_consumo_repuesto_id_fkey" FOREIGN KEY ("consumo_repuesto_id") REFERENCES "consumos_repuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_repuesto_id_fkey" FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity rules approved in the Phase 2 persistence alignment.
-- Prisma models the portable structure; PostgreSQL enforces the rules that need
-- partial indexes or cross-field CHECK constraints.

-- One active assignment per driver and one active assignment per bus.
CREATE UNIQUE INDEX "ux_asignacion_conductor_activa"
ON "asignaciones_conductor"("conductor_id")
WHERE "activa" = true;

CREATE UNIQUE INDEX "ux_asignacion_bus_activa"
ON "asignaciones_conductor"("bus_id")
WHERE "activa" = true;

-- One active preventive work order per maintenance schedule, while preserving
-- any number of closed historical orders.
CREATE UNIQUE INDEX "ux_orden_preventiva_activa_programacion"
ON "ordenes_trabajo"("programacion_mantenimiento_id")
WHERE "programacion_mantenimiento_id" IS NOT NULL
  AND "estado" <> 'CERRADA';

ALTER TABLE "usuarios"
ADD CONSTRAINT "ck_usuarios_intentos_login_no_negativo"
CHECK ("intentos_fallidos_login" >= 0);

ALTER TABLE "buses"
ADD CONSTRAINT "ck_buses_kilometraje_no_negativo"
CHECK ("kilometraje_actual" >= 0);

ALTER TABLE "lecturas_kilometraje"
ADD CONSTRAINT "ck_lecturas_kilometraje_coherente"
CHECK (
  "kilometraje_anterior" >= 0
  AND "kilometraje_nuevo" >= "kilometraje_anterior"
);

ALTER TABLE "asignaciones_conductor"
ADD CONSTRAINT "ck_asignaciones_conductor_estado_fechas"
CHECK (
  (
    "activa" = true
    AND "fecha_fin" IS NULL
  )
  OR (
    "activa" = false
    AND "fecha_fin" IS NOT NULL
    AND "fecha_fin" >= "fecha_inicio"
  )
);

ALTER TABLE "programaciones_mantenimiento"
ADD CONSTRAINT "ck_programaciones_mantenimiento_criterio"
CHECK (
  (
    "criterio" = 'FECHA'
    AND "fecha_programada" IS NOT NULL
    AND "kilometraje_objetivo" IS NULL
  )
  OR (
    "criterio" = 'KILOMETRAJE'
    AND "fecha_programada" IS NULL
    AND "kilometraje_objetivo" IS NOT NULL
    AND "kilometraje_objetivo" > 0
  )
  OR (
    "criterio" = 'FECHA_KILOMETRAJE'
    AND "fecha_programada" IS NOT NULL
    AND "kilometraje_objetivo" IS NOT NULL
    AND "kilometraje_objetivo" > 0
  )
);

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ck_ordenes_origen_coherente"
CHECK (
  (
    "origen" = 'NOVEDAD'
    AND "tipo" = 'CORRECTIVA'
    AND "novedad_id" IS NOT NULL
    AND "programacion_mantenimiento_id" IS NULL
  )
  OR (
    "origen" = 'PREVENTIVO'
    AND "tipo" = 'PREVENTIVA'
    AND "novedad_id" IS NULL
    AND "programacion_mantenimiento_id" IS NOT NULL
    AND (
      "fecha_objetivo_preventivo" IS NOT NULL
      OR "kilometraje_objetivo_preventivo" IS NOT NULL
    )
  )
  OR (
    "origen" = 'CORRECTIVO_DIRECTO'
    AND "tipo" = 'CORRECTIVA'
    AND "novedad_id" IS NULL
    AND "programacion_mantenimiento_id" IS NULL
  )
);

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ck_ordenes_tecnico_segun_estado"
CHECK (
  (
    "estado" = 'PENDIENTE_ASIGNACION'
    AND "tecnico_asignado_id" IS NULL
  )
  OR (
    "estado" <> 'PENDIENTE_ASIGNACION'
    AND "tecnico_asignado_id" IS NOT NULL
  )
);

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ck_ordenes_cierre_responsable"
CHECK (
  "estado" <> 'CERRADA'
  OR (
    "fecha_cierre" IS NOT NULL
    AND "cerrada_por_id" IS NOT NULL
  )
);

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ck_ordenes_ejecucion_minima"
CHECK (
  "estado" NOT IN ('COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION', 'CERRADA')
  OR (
    "fecha_inicio_ejecucion" IS NOT NULL
    AND "fecha_completada_tecnico" IS NOT NULL
  )
);

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ck_ordenes_costos_km_no_negativos"
CHECK (
  "costo_total" >= 0
  AND (
    "kilometraje_objetivo_preventivo" IS NULL
    OR "kilometraje_objetivo_preventivo" > 0
  )
);

ALTER TABLE "intervenciones"
ADD CONSTRAINT "ck_intervenciones_fechas"
CHECK (
  "fecha_fin" IS NULL
  OR "fecha_fin" >= "fecha_inicio"
);

ALTER TABLE "repuestos"
ADD CONSTRAINT "ck_repuestos_valores_no_negativos"
CHECK (
  "stock_actual" >= 0
  AND "stock_minimo" >= 0
  AND "costo_unitario" >= 0
);

ALTER TABLE "consumos_repuesto"
ADD CONSTRAINT "ck_consumos_repuesto_valores"
CHECK (
  "cantidad" > 0
  AND "costo_unitario" >= 0
  AND "subtotal" >= 0
);

ALTER TABLE "movimientos_inventario"
ADD CONSTRAINT "ck_movimientos_inventario_valores"
CHECK (
  "cantidad" > 0
  AND (
    "costo_unitario" IS NULL
    OR "costo_unitario" >= 0
  )
);

ALTER TABLE "movimientos_inventario"
ADD CONSTRAINT "ck_movimientos_inventario_consumo"
CHECK (
  (
    "tipo" = 'CONSUMO'
    AND "consumo_repuesto_id" IS NOT NULL
  )
  OR (
    "tipo" <> 'CONSUMO'
    AND "consumo_repuesto_id" IS NULL
  )
);
