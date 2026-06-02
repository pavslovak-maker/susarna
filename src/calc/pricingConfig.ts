import type { WoodSpecies, TargetMoistureBand } from "../domain/types.js";

/**
 * Koeficienty kalkulačky jako DATA, ne natvrdo v kódu (zadání kap. 4 a 5).
 * Celá tabulka je verzovaná: každá poptávka si uloží `version`, aby šlo
 * dohledat, podle čeho byl historický odhad spočítán (kap. 4.3, právní krytí).
 *
 * V produkci je toto řádek v DB (tabulka pricing_config), editovatelný adminem.
 * Tady je default seed.
 */
export interface PricingConfig {
  version: number;
  effectiveFrom: string; // ISO datum

  /** Základní rychlost sušení v mm/den dle druhu (kap. 4.1). */
  dryingSpeedMmPerDay: Record<WoodSpecies, number>;

  /** Základní cenová sazba Kč/m³ dle druhu (bez DPH). */
  baseRateCzkPerM3: Record<WoodSpecies, number>;

  /** Koeficient vstupní vlhkosti — prahy v % a násobitel (kap. 5.3). */
  inputMoistureCoef: { upToPct: number; coef: number }[];

  /** Koeficient cílové vlhkosti dle pásma (kap. 5.3). */
  targetMoistureCoef: Record<TargetMoistureBand, number>;

  /** Nelineární korekce času dle tloušťky: čas ~ (tloušťka/ref)^exponent. */
  thickness: { referenceMm: number; exponent: number };

  /** Příplatek k ceně za silné řezivo: Kč/m³ za každý mm nad práh. */
  thicknessSurchargeCzkPerMmPerM3: { thresholdMm: number; ratePerMm: number };

  /** Bezpečnostní rezerva ve dnech (nájezd + dochlazení, kap. 4.1). */
  safetyMarginDays: number;

  /** Šíře odhadovaného rozsahu min–max (± podíl, kap. 4.2). */
  estimateSpread: number;

  /** Sazba DPH pro B2C zobrazení. */
  vatRate: number;

  /** Minimální cena zakázky (Kč bez DPH) — řešeno v kap. 5.5. */
  minOrderPriceCzk: number;

  /** Množstevní sleva: od objemu → sleva (kap. 5.5). */
  volumeDiscounts: { fromM3: number; discount: number }[];
}

export const DEFAULT_PRICING: PricingConfig = {
  version: 1,
  effectiveFrom: "2026-06-01",
  dryingSpeedMmPerDay: { smrk: 4.0, borovice: 3.5, dub: 1.5, buk: 1.8, jasan: 1.7 },
  baseRateCzkPerM3: { smrk: 1200, borovice: 1300, dub: 2200, buk: 2000, jasan: 2100 },
  inputMoistureCoef: [
    { upToPct: 30, coef: 1.0 },
    { upToPct: 45, coef: 1.3 },
    { upToPct: Infinity, coef: 1.6 },
  ],
  targetMoistureCoef: { "12-15": 1.0, "8-11": 1.2, "6-8": 1.4 },
  thickness: { referenceMm: 25, exponent: 1.6 },
  thicknessSurchargeCzkPerMmPerM3: { thresholdMm: 50, ratePerMm: 8 },
  safetyMarginDays: 4,
  estimateSpread: 0.15,
  vatRate: 0.21,
  minOrderPriceCzk: 1500,
  volumeDiscounts: [
    { fromM3: 10, discount: 0.05 },
    { fromM3: 18, discount: 0.1 },
  ],
};
