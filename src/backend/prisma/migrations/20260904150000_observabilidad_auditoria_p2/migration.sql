CREATE TABLE "eventos_auditoria" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID,
    "accion" VARCHAR(180) NOT NULL,
    "metodo" VARCHAR(10) NOT NULL,
    "ruta" VARCHAR(255) NOT NULL,
    "recurso_tipo" VARCHAR(100),
    "recurso_id" VARCHAR(120),
    "resultado" VARCHAR(30) NOT NULL,
    "status_http" SMALLINT NOT NULL,
    "ip_hash" CHAR(64),
    "detalles" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "fecha_evento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_auditoria_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eventos_auditoria_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ck_eventos_auditoria_metodo" CHECK ("metodo" IN ('POST', 'PUT', 'PATCH', 'DELETE')),
    CONSTRAINT "ck_eventos_auditoria_resultado" CHECK ("resultado" IN ('EXITO', 'RECHAZADO')),
    CONSTRAINT "ck_eventos_auditoria_status_http" CHECK ("status_http" BETWEEN 100 AND 599)
);

CREATE INDEX "eventos_auditoria_actor_id_fecha_evento_idx" ON "eventos_auditoria"("actor_id", "fecha_evento");
CREATE INDEX "eventos_auditoria_recurso_tipo_recurso_id_fecha_evento_idx" ON "eventos_auditoria"("recurso_tipo", "recurso_id", "fecha_evento");
CREATE INDEX "eventos_auditoria_request_id_idx" ON "eventos_auditoria"("request_id");
