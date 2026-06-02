# Rezervační systém pro zakázkové sušení dřeva — návrh řešení

Verze 0.1 · MVP jádro · TypeScript / Node.js

## 1. Architektonické rozhodnutí

**Doporučená architektura: modulární monolit (TypeScript), PostgreSQL, jeden VPS.**

Pro daný provoz (2 komory × 20 m³, ruční schvalování rezervací, malý objem zakázek)
je serverless i mikroslužby předražené a zbytečně složité. Monolit s čistě
oddělenými moduly dává nejlepší poměr jednoduchost / udržovatelnost / náklady a lze
ho později rozříznout, pokud provoz poroste.

Vrstvy (čistá architektura — závislosti směřují dovnitř):

- **Doména** (`src/domain`) — typy, validace, stavový automat. Nezná DB ani HTTP.
- **Výpočet** (`src/calc`) — kalkulačka času a ceny; koeficienty jako verzovaná data.
- **Plánování** (`src/planning`) — kompatibilita vsázek, kapacita, návrh termínů.
- **Aplikace** (`src/app`) — orchestrace use-casů.
- **Infrastruktura** (`src/db`) — schéma; repository implementace (mimo MVP jádro).

Klíčové návrhové volby a jejich důvody:

1. **Koeficienty kalkulačky jsou data, ne kód, a jsou verzované.** Každá poptávka
   si uloží `pricing_version`, takže historický odhad lze přesně rekonstruovat
   (zadání kap. 4.3). Provozovatel ladí hodnoty v adminu bez zásahu vývojáře.
2. **Plánování NEdělá automatický optimální bin-packing.** Pro 2 komory je to
   zbytečné (a obecně NP-těžké). Systém jen navrhuje umístění (připojit ke
   kompatibilní vsázce / nová vsázka) a provozovatel rozhoduje ručně — přesně dle
   zvoleného režimu „ruční schválení".
3. **Hybrid DPH:** cena se interně počítá vždy bez DPH; B2C vidí cenu s DPH, B2B bez.
4. **Stavový automat s explicitním whitelistem přechodů** brání nesmyslným skokům
   a chrání integritu dat; každý přechod se loguje (audit).

## 2. Trade-offs

| Volba | Pro | Proti / kdy přehodnotit |
|---|---|---|
| Monolit místo mikroslužeb | Jednoduchost, levný provoz, snadné testy | Při mnoha komorách/lokalitách rozdělit |
| Ruční plánování (návrh + schválení) | Žádný těžký solver ani locking | Při velkém objemu poptávek doplnit auto-skládání |
| Koeficienty v JSONB | Editace bez migrací, flexibilní | Slabší validace schématu — řešit v app vrstvě |
| `used_m3` denormalizované | Rychlá kontrola kapacity | Nutná konzistence v transakci při přiřazení |
| Odhad času ze vzorce | Plně transparentní, laditelný | Méně přesný než data z praxe — kalibrovat |

## 3. Implementace

Hotové a otestované MVP jádro (912 řádků, 22/22 testů zelených):

- `domain/types.ts` — doménové typy, mapy tvrdosti a pásem vlhkosti.
- `domain/validation.ts` — validace vstupů včetně edge cases (objem > kapacita,
  vstupní vlhkost ≤ cílová apod.).
- `domain/workflow.ts` — stavový automat zakázky dle kap. 7.2.
- `calc/pricingConfig.ts` — verzovaná konfigurace koeficientů (seed v1).
- `calc/calculator.ts` — výpočet času (nelineární vliv tloušťky) a ceny
  (koeficienty, příplatky, slevy, min. cena, DPH, zaokrouhlení nahoru).
- `planning/planner.ts` — kompatibilita vsázek + návrh termínů s preferencí
  vytíženosti.
- `app/createInquiry.ts` — složení use-casu poptávky (spustitelné demo).
- `db/schema.sql` — PostgreSQL schéma odpovídající datovému modelu kap. 10.

## 4. Validace / testy

`npm test` (běží přes `tsx --test`, vestavěný test runner — nulové závislosti):

- Kalkulačka: tvrdé > měkké, nelinearita tloušťky, rozsah min–max, vliv cílové
  vlhkosti, hybrid DPH, minimální cena, množstevní sleva, zaokrouhlení, verzování.
- Validace: validní vstupy, objem nad kapacitu, vlhkost pod cíl, neznámý druh.
- Workflow: povolené přechody, zákaz nesmyslných skoků, finální stavy.
- Planner: kompatibilita, zákaz míchání tvrdé/měkké, limit tloušťky, preference
  připojení, plná vsázka, posun termínu při obsazené komoře.

Doporučené doplnění před produkcí: integrační testy repository vrstvy (kontrola
kapacity v transakci) a property-based testy kalkulačky (monotonie cen/času).

## 5. Produkční poznámky

**Doporučený stack:** Node.js 22 LTS + TypeScript, Fastify (HTTP), PostgreSQL 16,
Prisma nebo Kysely (typovaný přístup k DB), React + Vite (frontend). Hosting: jeden
VPS (např. Hetzner CX22, ~5 €/měs) + spravovaný Postgres nebo Postgres v Dockeru se
zálohou. Náklady na provoz řádově stovky Kč/měsíc.

**Souběžnost (race condition):** dvě poptávky na poslední místo v cyklu se řeší až
při schvalování (POPTAVKA → POTVRZENO) jednou transakcí s kontrolou
`used_m3 + volume_m3 <= capacity_m3` a optimistickým zámkem (verze řádku cyklu).

**Error handling:** doménové chyby (`ValidationError`, `IllegalTransitionError`) se
mapují na HTTP 4xx s konkrétním seznamem problémů; neočekávané chyby na 5xx bez
úniku detailů.

**Logging & monitoring:** strukturované JSON logy (pino), korelované request-id;
sledovat: počet poptávek, míru schválení, vytíženost komor. Alerting na chyby 5xx a
na nedoručené notifikace.

**Fallback scénáře:** výpadek e-mail/SMS brány → fronta s retry a ruční přehled
nedoručených v adminu; výpadek DB → read-only režim s jasnou hláškou; generování
PDF/ISDOC mimo request (job), aby selhání neblokovalo workflow.

**Bezpečnost & GDPR:** kontakty a IČO/DIČ jsou osobní údaje — šifrované spojení,
přístup adminu za autentizací (role provozovatel/účetní), retenční politika, export
a výmaz na žádost. Ceny a koeficienty needitovatelné běžným uživatelem.

**Rizika a omezení:**
- Odhad času je jen tak dobrý jako koeficienty — nutná kalibrace z praxe.
- ISDOC/DPH fakturace má legislativní náležitosti (náležitosti daňového dokladu) —
  před nasazením ověřit s účetním; připraveno jako samostatný modul (fáze 3).
- Kompatibilita vsázek je zjednodušená (druh + pásmo + tloušťka); reálně může hrát
  roli i vlhkost a režim komory — rozšiřitelné v pravidlech.

## Otevřená rozhodnutí — jak jsou zapracována

| Rozhodnutí (kap. 11.1) | Zvolené řešení |
|---|---|
| Míchání vsázek vs. celé komory | Míchání kompatibilních zakázek (verze 2) |
| Auto vs. ruční schvalování | Ruční schválení provozovatelem |
| Cenový model / DPH | Za m³, hybrid: B2C s DPH, B2B bez |
| Zdroj koeficientů | Editovatelná verzovaná data v adminu |
| Rozsah MVP | Jádro: konfigurátor + kalkulačka + plánování + workflow |

Stále k potvrzení s provozovatelem: konkrétní hodnoty koeficientů a sazeb (teď
ilustrativní), prahy množstevních slev, a zda se energie účtuje i u poloprázdné
vsázky (kap. 5.5) — to lze doplnit jako alternativní cenový režim „za komoru".
