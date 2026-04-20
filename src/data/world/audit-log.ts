export const AUDIT_LOG_SQL = `
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  operator TEXT,
  operated_at TIMESTAMP DEFAULT NOW()
);
`