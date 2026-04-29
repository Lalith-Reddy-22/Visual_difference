const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vrapp',
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'viewer',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS runs (
      run_id         UUID PRIMARY KEY,
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type           TEXT NOT NULL DEFAULT 'compare',
      staging_url    TEXT,
      production_url TEXT,
      status         TEXT NOT NULL DEFAULT 'running',
      started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at    TIMESTAMPTZ,
      results        JSONB NOT NULL DEFAULT '[]',
      summary        JSONB NOT NULL DEFAULT '{"total":0,"passed":0,"failed":0}'
    );

    CREATE TABLE IF NOT EXISTS configs (
      user_id  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      config   JSONB NOT NULL
    );

    -- Tracks every captured screenshot and diff image
    CREATE TABLE IF NOT EXISTS snapshots (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id      UUID REFERENCES runs(run_id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('staging','production','diff','snapshot')),
      page_name   TEXT NOT NULL,
      viewport    TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      url_path    TEXT NOT NULL,
      width       INT,
      height      INT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Tracks the current approved baseline per user/page/viewport
    CREATE TABLE IF NOT EXISTS baselines (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      page_name   TEXT NOT NULL,
      viewport    TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      url_path    TEXT NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, page_name, viewport)
    );

    CREATE INDEX IF NOT EXISTS idx_runs_user_id      ON runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_runs_started_at   ON runs(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_run_id  ON snapshots(run_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON snapshots(user_id);
    CREATE INDEX IF NOT EXISTS idx_baselines_user_id ON baselines(user_id);
  `);
}

module.exports = { pool, init };
