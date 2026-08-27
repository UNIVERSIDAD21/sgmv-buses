ALTER TYPE "rol_codigo" RENAME VALUE 'ADMIN_SUPERVISOR' TO 'ADMINISTRADOR';
ALTER TYPE "rol_codigo" RENAME VALUE 'CONDUCTOR_OPERADOR' TO 'CONDUCTOR';

UPDATE "roles"
SET
    "nombre" = 'Administrador',
    "descripcion" = 'Integra funciones administrativas y de supervision del prototipo.'
WHERE "codigo" = 'ADMINISTRADOR';

UPDATE "roles"
SET
    "nombre" = 'Conductor',
    "descripcion" = 'Opera el bus, consulta informacion autorizada y registra novedades operativas.'
WHERE "codigo" = 'CONDUCTOR';

UPDATE "roles"
SET
    "nombre" = 'Mecánico',
    "descripcion" = 'Ejecuta intervenciones de mantenimiento y registra actividades tecnicas autorizadas.'
WHERE "codigo" = 'MECANICO';
