DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'date'
      AND (table_name, column_name) IN (('Client','vendedorAlocadoEm'),
                                        ('Comissao','createdAt'),
                                        ('Comissao','vencimento'),
                                        ('ContaPagar','vencimento'),
                                        ('UserLancamento','data'))
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz(6) USING %I::timestamp AT TIME ZONE ''America/Sao_Paulo'';',
      r.table_schema, r.table_name, r.column_name, r.column_name
    );
  END LOOP;
END $$;
