ALTER TABLE "eventos_auditoria"
DROP CONSTRAINT "eventos_auditoria_actor_id_fkey";

ALTER TABLE "eventos_auditoria"
ADD CONSTRAINT "eventos_auditoria_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
