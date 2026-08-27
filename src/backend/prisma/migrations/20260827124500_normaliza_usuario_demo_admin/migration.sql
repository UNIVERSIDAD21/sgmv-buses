UPDATE "usuarios"
SET
    "email" = 'administrador.demo@sgmv.local',
    "nombre" = 'Administrador Demo'
WHERE "email" = 'supervisor.demo@sgmv.local'
  AND NOT EXISTS (
      SELECT 1
      FROM "usuarios" AS "usuario_admin_demo"
      WHERE "usuario_admin_demo"."email" = 'administrador.demo@sgmv.local'
  );

UPDATE "usuarios"
SET "nombre" = 'Administrador Demo'
WHERE "email" = 'administrador.demo@sgmv.local'
  AND "nombre" = 'Supervisor Demo';
