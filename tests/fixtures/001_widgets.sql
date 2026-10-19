-- Fixture for the harness self-test (T-022). Idempotent by design.
CREATE TABLE IF NOT EXISTS widgets (id integer PRIMARY KEY, name text NOT NULL);
INSERT INTO widgets (id, name) VALUES (1, 'alpha'), (2, 'beta') ON CONFLICT (id) DO NOTHING;
