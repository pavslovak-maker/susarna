import type { OrderParams, CustomerType } from "../domain/types.js";
import { TARGET_BAND_MIDPOINT } from "../domain/types.js";
import type { PricingConfig } from "./pricingConfig.js";

export interface DurationEstimate {
  /** Střední odhad ve dnech (vč. bezpečnostní rezervy). */
  days: number;
  /** Rozsah min–max ve dnech (kap. 4.2). */
  minDays: number;
  maxDays: number;
}

export interface PriceBreakdown {
  /** Vše bez DPH; rozpad kvůli transparentnosti a auditu. */
  base: number;
  afterMoistureCoefs: number;
  thicknessSurcharge: number;
  beforeDiscount: number;
  volumeDiscount: number;
  netPrice: number; // bez DPH, po slevě, po aplikaci min. ceny
  minPriceApplied: boolean;
  vat: number;
  grossPrice: number; // s DPH
}

export interface CalcResult {
  duration: DurationEstimate;
  price: PriceBreakdown;
  /** Co zákazník reálně vidí dle své role (hybrid model). */
  displayPrice: number;
  displayWithVat: boolean;
  /** Verze koeficientů — uloží se k poptávce (audit, kap. 4.3). */
  pricingVersion: number;
}

function pickInputMoistureCoef(cfg: PricingConfig, inputPct: number): number {
  // Prahy jsou seřazené vzestupně; vrátí první, do kterého hodnota spadá.
  for (const tier of cfg.inputMoistureCoef) {
    if (inputPct <= tier.upToPct) return tier.coef;
  }
  return cfg.inputMoistureCoef.at(-1)!.coef;
}

function pickVolumeDiscount(cfg: PricingConfig, volumeM3: number): number {
  // Bere nejvyšší slevu, na kterou objem dosáhne.
  let best = 0;
  for (const d of cfg.volumeDiscounts) {
    if (volumeM3 >= d.fromM3) best = Math.max(best, d.discount);
  }
  return best;
}

/** Zaokrouhlení ceny NAHORU na celé koruny — aby finální ≤ odhad (kap. 5.5). */
function roundUpCzk(value: number): number {
  return Math.ceil(value);
}

export function estimateDuration(params: OrderParams, cfg: PricingConfig): DurationEstimate {
  const speed = cfg.dryingSpeedMmPerDay[params.species];
  const targetPct = TARGET_BAND_MIDPOINT[params.targetBand];

  // Kolik vlhkosti je třeba odebrat. Floor na 1, ať i proschlé dřevo má kladný čas.
  const moistureDelta = Math.max(1, params.inputMoisturePct - targetPct);

  // Nelineární vliv tloušťky: poloviční tloušťka schne výrazně rychleji.
  const thicknessFactor = Math.pow(
    params.thicknessMm / cfg.thickness.referenceMm,
    cfg.thickness.exponent,
  );

  // Hrubý počet dní: čím víc vlhkosti odebrat a čím silnější/pomalejší druh, tím déle.
  const rawDays = (moistureDelta / speed) * thicknessFactor;
  const days = Math.ceil(rawDays + cfg.safetyMarginDays);

  return {
    days,
    minDays: Math.max(1, Math.floor(days * (1 - cfg.estimateSpread))),
    maxDays: Math.ceil(days * (1 + cfg.estimateSpread)),
  };
}

export function calculatePrice(
  params: OrderParams,
  cfg: PricingConfig,
  customerType: CustomerType,
): PriceBreakdown {
  const base = params.volumeM3 * cfg.baseRateCzkPerM3[params.species];

  const inputCoef = pickInputMoistureCoef(cfg, params.inputMoisturePct);
  const targetCoef = cfg.targetMoistureCoef[params.targetBand];
  const afterMoistureCoefs = base * inputCoef * targetCoef;

  // Příplatek za silné řezivo nad práh, lineárně za mm, násobeno objemem.
  const over = Math.max(0, params.thicknessMm - cfg.thicknessSurchargeCzkPerMmPerM3.thresholdMm);
  const thicknessSurcharge =
    over * cfg.thicknessSurchargeCzkPerMmPerM3.ratePerMm * params.volumeM3;

  const beforeDiscount = afterMoistureCoefs + thicknessSurcharge;
  const discountRate = pickVolumeDiscount(cfg, params.volumeM3);
  const volumeDiscount = beforeDiscount * discountRate;

  let net = beforeDiscount - volumeDiscount;
  const minPriceApplied = net < cfg.minOrderPriceCzk;
  if (minPriceApplied) net = cfg.minOrderPriceCzk;
  net = roundUpCzk(net);

  // DPH se vždy počítá; zda se zobrazí, řeší displayPrice (hybrid model).
  const vat = roundUpCzk(net * cfg.vatRate);
  const gross = net + vat;

  return {
    base,
    afterMoistureCoefs,
    thicknessSurcharge,
    beforeDiscount,
    volumeDiscount,
    netPrice: net,
    minPriceApplied,
    vat,
    grossPrice: gross,
  };
}

/** Spočítá čas i cenu zároveň ze sdílených vstupů (kap. 4.3). */
export function calculate(
  params: OrderParams,
  cfg: PricingConfig,
  customerType: CustomerType,
): CalcResult {
  const duration = estimateDuration(params, cfg);
  const price = calculatePrice(params, cfg, customerType);

  // Hybrid: B2C vidí cenu s DPH, B2B bez DPH.
  const displayWithVat = customerType === "B2C";
  return {
    duration,
    price,
    displayPrice: displayWithVat ? price.grossPrice : price.netPrice,
    displayWithVat,
    pricingVersion: cfg.version,
  };
}
