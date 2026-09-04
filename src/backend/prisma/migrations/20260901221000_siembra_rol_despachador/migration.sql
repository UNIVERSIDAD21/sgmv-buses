INSERT INTO "roles" ("id", "codigo", "nombre", "descripcion", "created_at", "updated_at")
VALUES (
  '10000000-0000-4000-8000-000000000004',
  'DESPACHADOR',
  'Despachador',
  'Coordina jornadas, asignaciones, disponibilidad, salidas, llegadas y alertas operativas.',
  now(),
  now()
)
ON CONFLICT ("codigo") DO UPDATE
SET
  "nombre" = EXCLUDED."nombre",
  "descripcion" = EXCLUDED."descripcion",
  "updated_at" = now();
