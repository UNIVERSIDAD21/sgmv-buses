CREATE TYPE "estado_autorizacion_excepcion" AS ENUM ('VIGENTE', 'USADA', 'REVOCADA');

CREATE TABLE "autorizaciones_excepcion_consumo" (
  "id" UUID NOT NULL,
  "orden_trabajo_id" UUID NOT NULL,
  "intervencion_id" UUID NOT NULL,
  "repuesto_id" UUID NOT NULL,
  "cantidad_maxima" DECIMAL(12,2) NOT NULL,
  "motivo" TEXT NOT NULL,
  "autorizado_por_id" UUID NOT NULL,
  "fecha_autorizacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_expiracion" TIMESTAMPTZ(6),
  "estado" "estado_autorizacion_excepcion" NOT NULL DEFAULT 'VIGENTE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "autorizaciones_excepcion_consumo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_p8_autorizacion_cantidad" CHECK ("cantidad_maxima" > 0),
  CONSTRAINT "ck_p8_autorizacion_motivo" CHECK (length(btrim("motivo")) >= 3),
  CONSTRAINT "ck_p8_autorizacion_expiracion" CHECK ("fecha_expiracion" IS NULL OR "fecha_expiracion" > "fecha_autorizacion")
);

ALTER TABLE "consumos_repuesto"
  ADD COLUMN "autorizacion_excepcion_id" UUID;

CREATE UNIQUE INDEX "consumos_repuesto_autorizacion_excepcion_id_key"
  ON "consumos_repuesto"("autorizacion_excepcion_id")
  WHERE "autorizacion_excepcion_id" IS NOT NULL;
CREATE INDEX "autorizaciones_excepcion_consumo_orden_trabajo_id_estado_idx"
  ON "autorizaciones_excepcion_consumo"("orden_trabajo_id", "estado");
CREATE INDEX "autorizaciones_excepcion_consumo_intervencion_id_estado_idx"
  ON "autorizaciones_excepcion_consumo"("intervencion_id", "estado");
CREATE INDEX "autorizaciones_excepcion_consumo_repuesto_id_estado_idx"
  ON "autorizaciones_excepcion_consumo"("repuesto_id", "estado");
CREATE INDEX "autorizaciones_excepcion_consumo_autorizado_por_id_idx"
  ON "autorizaciones_excepcion_consumo"("autorizado_por_id");

ALTER TABLE "autorizaciones_excepcion_consumo"
  ADD CONSTRAINT "autorizaciones_excepcion_consumo_orden_trabajo_id_fkey"
    FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "autorizaciones_excepcion_consumo_intervencion_id_fkey"
    FOREIGN KEY ("intervencion_id") REFERENCES "intervenciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "autorizaciones_excepcion_consumo_repuesto_id_fkey"
    FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "autorizaciones_excepcion_consumo_autorizado_por_id_fkey"
    FOREIGN KEY ("autorizado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consumos_repuesto"
  ADD CONSTRAINT "consumos_repuesto_autorizacion_excepcion_id_fkey"
    FOREIGN KEY ("autorizacion_excepcion_id") REFERENCES "autorizaciones_excepcion_consumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ck_p8_consumo_excepcion_referenciada" CHECK (
    ("resultado_compatibilidad" = 'EXCEPCION_AUTORIZADA' AND "autorizacion_excepcion_id" IS NOT NULL)
    OR ("resultado_compatibilidad" <> 'EXCEPCION_AUTORIZADA' AND "autorizacion_excepcion_id" IS NULL)
    OR "resultado_compatibilidad" IS NULL
  );

CREATE OR REPLACE FUNCTION sgmv_p8_validar_excepcion_consumo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a autorizaciones_excepcion_consumo%ROWTYPE; r roles%ROWTYPE;
BEGIN
  IF NEW.resultado_compatibilidad <> 'EXCEPCION_AUTORIZADA' THEN RETURN NEW; END IF;
  SELECT * INTO STRICT a FROM autorizaciones_excepcion_consumo
    WHERE id = NEW.autorizacion_excepcion_id FOR UPDATE;
  SELECT r.* INTO STRICT r FROM roles r JOIN usuarios u ON u.rol_id = r.id
    WHERE u.id = a.autorizado_por_id;
  IF r.codigo <> 'ADMINISTRADOR' OR a.estado <> 'VIGENTE'
     OR a.orden_trabajo_id <> NEW.orden_trabajo_id
     OR a.intervencion_id <> NEW.intervencion_id
     OR a.repuesto_id <> NEW.repuesto_id
     OR a.autorizado_por_id IS DISTINCT FROM NEW.autorizado_por_id
     OR NEW.cantidad > a.cantidad_maxima
     OR a.fecha_autorizacion > NEW.fecha_consumo
     OR (a.fecha_expiracion IS NOT NULL AND a.fecha_expiracion <= NEW.fecha_consumo) THEN
    RAISE EXCEPTION 'La autorizacion de excepcion no corresponde al consumo' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_p8_validar_excepcion_consumo
  BEFORE INSERT OR UPDATE OF resultado_compatibilidad, autorizacion_excepcion_id,
    autorizado_por_id, cantidad, orden_trabajo_id, intervencion_id, repuesto_id
  ON "consumos_repuesto" FOR EACH ROW EXECUTE FUNCTION sgmv_p8_validar_excepcion_consumo();
