/**
 * SQLite databáze pomocí vestavěného node:sqlite (Node.js 22.5+).
 * Nevyžaduje žádné nativní doplňky — funguje bez Visual Studio.
 */
// @ts-ignore — node:sqlite je v Node 22+ stabilní, ale starší typy ho neznají
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { DEFAULT_PRICING } from "../calc/pricingConfig.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, "../../susarna.db");

export const db = new DatabaseSync(DB_PATH);

// WAL mode + foreign keys
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

/** Inicializace schématu — idempotentní, volá se při startu serveru. */
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_config (
      version        INTEGER PRIMARY KEY,
      effective_from TEXT NOT NULL,
      config         TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL CHECK (type IN ('B2C','B2B')),
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      phone      TEXT,
      ico        TEXT,
      dic        TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chamber (
      id              TEXT PRIMARY KEY,
      capacity_m3     REAL NOT NULL,
      allowed_species TEXT,
      state           TEXT NOT NULL DEFAULT 'VOLNA'
                        CHECK (state IN ('VOLNA','PLNI_SE','SUSI','CHLADNE'))
    );

    CREATE TABLE IF NOT EXISTS drying_cycle (
      id           TEXT PRIMARY KEY,
      chamber_id   TEXT NOT NULL REFERENCES chamber(id),
      status       TEXT NOT NULL DEFAULT 'PLANOVANY'
                     CHECK (status IN ('PLANOVANY','BEZICI','DOKONCENY','ZRUSENY')),
      species      TEXT NOT NULL,
      target_band  TEXT NOT NULL CHECK (target_band IN ('12-15','8-11','6-8')),
      thickness_mm REAL NOT NULL,
      starts_at    TEXT NOT NULL,
      ends_at      TEXT NOT NULL,
      used_m3      REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wood_order (
      id                 TEXT PRIMARY KEY,
      customer_id        TEXT NOT NULL REFERENCES customer(id),
      cycle_id           TEXT REFERENCES drying_cycle(id),
      status             TEXT NOT NULL DEFAULT 'POPTAVKA'
                           CHECK (status IN ('POPTAVKA','POTVRZENO','NASKLADNENO',
                                             'SUSI','HOTOVO','ODEBRANO','FAKTUROVANO','ZRUSENO')),
      species            TEXT NOT NULL,
      volume_m3          REAL NOT NULL,
      input_moisture_pct REAL NOT NULL,
      target_band        TEXT NOT NULL CHECK (target_band IN ('12-15','8-11','6-8')),
      thickness_mm       REAL NOT NULL,
      lumber_kind        TEXT NOT NULL CHECK (lumber_kind IN ('fosny','hranoly','prkna')),
      estimated_days     INTEGER,
      net_price_czk      REAL,
      pricing_version    INTEGER REFERENCES pricing_config(version),
      notes              TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    TEXT NOT NULL REFERENCES wood_order(id),
      from_status TEXT,
      to_status   TEXT NOT NULL,
      changed_by  TEXT NOT NULL,
      changed_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_order_status ON wood_order(status);
    CREATE INDEX IF NOT EXISTS idx_cycle_compat ON drying_cycle(status, species, target_band);
  `);

  // Seed: komory K1 a K2
  const chamberCount = (db.prepare("SELECT COUNT(*) as n FROM chamber").get() as { n: number }).n;
  if (chamberCount === 0) {
    db.prepare("INSERT INTO chamber (id, capacity_m3) VALUES (?,?)").run("K1", 20);
    db.prepare("INSERT INTO chamber (id, capacity_m3) VALUES (?,?)").run("K2", 20);
  }

  // Seed: výchozí ceník (verze 1)
  const cfgCount = (db.prepare("SELECT COUNT(*) as n FROM pricing_config").get() as { n: number }).n;
  if (cfgCount === 0) {
    db.prepare("INSERT INTO pricing_config (version, effective_from, config) VALUES (?,?,?)").run(
      DEFAULT_PRICING.version,
      DEFAULT_PRICING.effectiveFrom,
      JSON.stringify(DEFAULT_PRICING),
    );
  }
}
