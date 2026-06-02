-- Schéma pro PostgreSQL. Odpovídá datovému modelu ze zadání (kap. 10).
-- Klíčové designové volby jsou komentované u jednotlivých míst (proč, ne co).

-- Verzovaný ceník/koeficienty. Každá poptávka referencuje konkrétní verzi,
-- takže historický odhad lze přesně rekonstruovat (kap. 4.3, audit/právní krytí).
CREATE TABLE pricing_config (
    version        INTEGER PRIMARY KEY,
    effective_from DATE NOT NULL,
    -- Celá tabulka koeficientů jako JSONB: flexibilní editace v adminu bez migrací.
    config         JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        TEXT NOT NULL CHECK (type IN ('B2C','B2B')),
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    ico         TEXT,  -- jen B2B
    dic         TEXT,  -- jen B2B
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chamber (
    id           TEXT PRIMARY KEY,            -- 'K1','K2'
    capacity_m3  NUMERIC(6,2) NOT NULL CHECK (capacity_m3 > 0),
    allowed_species TEXT[],                    -- NULL = univerzální
    state        TEXT NOT NULL DEFAULT 'VOLNA'
                   CHECK (state IN ('VOLNA','PLNI_SE','SUSI','CHLADNE'))
);

-- Sušicí cyklus (vsázka). Profil (species/target/thickness) určuje kompatibilitu.
CREATE TABLE drying_cycle (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chamber_id   TEXT NOT NULL REFERENCES chamber(id),
    status       TEXT NOT NULL DEFAULT 'PLANOVANY'
                   CHECK (status IN ('PLANOVANY','BEZICI','DOKONCENY','ZRUSENY')),
    species      TEXT NOT NULL,
    target_band  TEXT NOT NULL CHECK (target_band IN ('12-15','8-11','6-8')),
    thickness_mm NUMERIC(5,1) NOT NULL,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    -- used_m3 je odvozená hodnota; držíme ji denormalizovaně pro rychlou kontrolu
    -- kapacity a aktualizujeme v téže transakci jako přiřazení zakázky.
    used_m3      NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (used_m3 >= 0),
    CHECK (ends_at > starts_at)
);

CREATE TABLE wood_order (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES customer(id),
    cycle_id      UUID REFERENCES drying_cycle(id),  -- NULL dokud není zařazeno
    status        TEXT NOT NULL DEFAULT 'POPTAVKA'
                    CHECK (status IN ('POPTAVKA','POTVRZENO','NASKLADNENO','SUSI',
                                      'HOTOVO','ODEBRANO','FAKTUROVANO','ZRUSENO')),
    -- Vstupní parametry (kap. 3.1).
    species       TEXT NOT NULL,
    volume_m3     NUMERIC(6,2) NOT NULL CHECK (volume_m3 > 0),
    input_moisture_pct NUMERIC(5,2) NOT NULL,
    target_band   TEXT NOT NULL CHECK (target_band IN ('12-15','8-11','6-8')),
    thickness_mm  NUMERIC(5,1) NOT NULL,
    lumber_kind   TEXT NOT NULL CHECK (lumber_kind IN ('fosny','hranoly','prkna')),
    -- Snapshot výpočtu — uložený výsledek + verze koeficientů (neměnný odhad).
    estimated_days     INTEGER,
    net_price_czk      NUMERIC(10,2),
    pricing_version    INTEGER REFERENCES pricing_config(version),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit přechodů stavů — kdo, kdy, z čeho do čeho (provozní dohledatelnost).
CREATE TABLE order_status_history (
    id          BIGSERIAL PRIMARY KEY,
    order_id    UUID NOT NULL REFERENCES wood_order(id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    changed_by  TEXT NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES wood_order(id),
    kind        TEXT NOT NULL CHECK (kind IN ('ZALOHOVA','FINALNI')),
    amount_czk  NUMERIC(10,2) NOT NULL,
    state       TEXT NOT NULL DEFAULT 'VYSTAVENO'
                  CHECK (state IN ('VYSTAVENO','PREDANO','UHRAZENO')),
    pdf_path    TEXT,
    isdoc_path  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexy pro nejčastější dotazy: fronta poptávek a hledání kompatibilních vsázek.
CREATE INDEX idx_order_status ON wood_order(status);
CREATE INDEX idx_cycle_compat ON drying_cycle(status, species, target_band);
