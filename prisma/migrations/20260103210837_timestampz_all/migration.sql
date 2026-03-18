DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type LIKE 'timestamp%'
      AND datetime_precision IS NOT NULL
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz(6) USING %I AT TIME ZONE ''America/Sao_Paulo'';',
      r.table_schema, r.table_name, r.column_name, r.column_name
    );
  END LOOP;
END $$;
