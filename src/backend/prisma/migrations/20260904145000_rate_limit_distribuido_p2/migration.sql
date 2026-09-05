CREATE TABLE "limites_tasa" (
    "ambito" VARCHAR(80) NOT NULL,
    "clave_hash" CHAR(64) NOT NULL,
    "ventana_inicio" TIMESTAMPTZ(6) NOT NULL,
    "contador" INTEGER NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "limites_tasa_pkey" PRIMARY KEY ("ambito", "clave_hash", "ventana_inicio"),
    CONSTRAINT "ck_limites_tasa_contador_positivo" CHECK ("contador" > 0),
    CONSTRAINT "ck_limites_tasa_expiracion" CHECK ("expira_at" > "ventana_inicio")
);

CREATE INDEX "limites_tasa_expira_at_idx" ON "limites_tasa"("expira_at");
