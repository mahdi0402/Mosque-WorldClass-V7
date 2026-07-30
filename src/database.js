import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localFile = path.join(__dirname, "..", "mosque-state.json");
const hasPostgres = Boolean(process.env.DATABASE_URL);

const pool = hasPostgres ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
}) : null;

export async function initDatabase(defaultState) {
  if (!pool) {
    if (!fs.existsSync(localFile)) {
      fs.writeFileSync(localFile, JSON.stringify(defaultState, null, 2), "utf8");
    }
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mosque_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      action VARCHAR(80) NOT NULL,
      ip VARCHAR(80),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `INSERT INTO mosque_settings (id, data)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(defaultState)]
  );
}

export async function readMosqueState() {
  if (!pool) {
    try { return JSON.parse(fs.readFileSync(localFile, "utf8")); }
    catch { return {}; }
  }
  const result = await pool.query("SELECT data FROM mosque_settings WHERE id = 1");
  return result.rows[0]?.data || {};
}

export async function saveMosqueState(state, audit = {}) {
  if (!pool) {
    fs.writeFileSync(localFile, JSON.stringify(state, null, 2), "utf8");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO mosque_settings (id, data, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(state)]
    );
    await client.query(
      `INSERT INTO admin_audit_log (action, ip, user_agent)
       VALUES ('UPDATE_MOSQUE_SETTINGS', $1, $2)`,
      [String(audit.ip || "").slice(0, 80), String(audit.userAgent || "").slice(0, 1000)]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseStatus() {
  if (!pool) return { ok: true, mode: "local-json" };
  try {
    await pool.query("SELECT 1");
    return { ok: true, mode: "postgresql" };
  } catch {
    return { ok: false, mode: "postgresql-unavailable" };
  }
}
