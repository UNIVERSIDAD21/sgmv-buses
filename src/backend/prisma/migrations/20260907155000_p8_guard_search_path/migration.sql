-- Congela las funciones P8 al schema de instalación y evita resolución de
-- objetos mediante un search_path controlable por la sesión.
DO $$
DECLARE
  target_schema text := current_schema();
BEGIN
  EXECUTE format(
    'ALTER FUNCTION sgmv_p8_validar_excepcion_consumo() SET search_path = %I, pg_catalog',
    target_schema
  );
  EXECUTE format(
    'ALTER FUNCTION sgmv_p8_marcar_excepcion_usada() SET search_path = %I, pg_catalog',
    target_schema
  );
END;
$$;
