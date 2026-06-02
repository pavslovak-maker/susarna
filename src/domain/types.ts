/**
 * Doménové typy. Záměrně oddělené od DB i HTTP vrstvy (čistá architektura):
 * výpočetní a plánovací jádro nesmí záviset na frameworku ani persistenci,
 * aby šlo testovat bez DB a později vyměnit infrastrukturu.
 */

/** Druh dřeva. Tvrdé schne pomaleji → vyšší sazba i delší cyklus. */
export type WoodSpecies = "smrk" | "borovice" | "dub" | "buk" | "jasan";

export type WoodHardness = "soft" | "hard";

/** Typ řeziva — ovlivňuje rovnoměrnost sušení (zatím jen evidence). */
export type LumberKind = "fosny" | "hranoly" | "prkna";

/** Cílová vlhkost je diskrétní pásmo (zadání kap. 3.1). */
export type TargetMoistureBand = "12-15" | "8-11" | "6-8";

/** Typ zákazníka řídí zobrazení DPH (hybrid model dle zadání). */
export type CustomerType = "B2C" | "B2B";

/**
 * Stav zakázky = stavový automat ze zadání kap. 7.2.
 * Pořadí je významné pro povolené přechody (viz workflow.ts).
 */
export type OrderStatus =
  | "POPTAVKA"
  | "POTVRZENO"
  | "NASKLADNENO"
  | "SUSI"
  | "HOTOVO"
  | "ODEBRANO"
  | "FAKTUROVANO"
  | "ZRUSENO";

/** Stav komory dle kap. 6.1. */
export type ChamberState = "VOLNA" | "PLNI_SE" | "SUSI" | "CHLADNE";

/** Stav sušicího cyklu (vsázky) — řídí, zda se k němu lze připojit. */
export type CycleStatus = "PLANOVANY" | "BEZICI" | "DOKONCENY" | "ZRUSENY";

/** Vstupní parametry zakázky — sdílené vstupy pro čas i cenu (kap. 4.3). */
export interface OrderParams {
  species: WoodSpecies;
  /** Objem v m³ — hlavní jednotka kapacity i ceny. */
  volumeM3: number;
  /** Vstupní vlhkost v % (0–100). */
  inputMoisturePct: number;
  targetBand: TargetMoistureBand;
  /** Tloušťka řeziva v mm — nelineární vliv na čas. */
  thicknessMm: number;
  lumberKind: LumberKind;
}

/** Reprezentace cílové vlhkosti jako číslo pro výpočet (střed pásma). */
export const TARGET_BAND_MIDPOINT: Record<TargetMoistureBand, number> = {
  "12-15": 13.5,
  "8-11": 9.5,
  "6-8": 7,
};

export const SPECIES_HARDNESS: Record<WoodSpecies, WoodHardness> = {
  smrk: "soft",
  borovice: "soft",
  dub: "hard",
  buk: "hard",
  jasan: "hard",
};
