/**
 * Ukázka, jak se jádro skládá do use-casu „vytvoř poptávku".
 * Application vrstva: orchestruje doménu, zatím s in-memory daty.
 * V produkci sem přijde repository (DB) za rozhraní — doména se nemění.
 */
import { validateOrderParams } from "../domain/validation.js";
import { calculate } from "../calc/calculator.js";
import { DEFAULT_PRICING } from "../calc/pricingConfig.js";
import { findPlacements, CHAMBER_CAPACITY_M3 } from "../planning/planner.js";
import type { Chamber, DryingCycle } from "../planning/planner.js";
import type { OrderParams, CustomerType } from "../domain/types.js";

export function createInquiry(
  rawParams: Partial<OrderParams>,
  customerType: CustomerType,
  chambers: Chamber[],
  cycles: DryingCycle[],
  now = new Date().toISOString(),
) {
  validateOrderParams(rawParams); // vyhodí ValidationError s konkrétními problémy
  const params = rawParams; // po validaci je typ zúžen na OrderParams

  const calc = calculate(params, DEFAULT_PRICING, customerType);
  const placements = findPlacements(params, chambers, cycles, now);

  return {
    calc,
    placements,
    // Datum dokončení navázané na nejlepší termín nástupu (kap. 4.2).
    expectedFinish: placements[0]
      ? new Date(Date.parse(placements[0].earliestStart) + calc.duration.days * 86_400_000).toISOString()
      : null,
    note: "Nezávazný odhad",
  };
}

// --- Demo běh (spustitelné: tsx src/app/createInquiry.ts) ---
if (import.meta.url.endsWith('createInquiry.ts')) {
  const chambers: Chamber[] = [
    { id: "K1", capacityM3: CHAMBER_CAPACITY_M3 },
    { id: "K2", capacityM3: CHAMBER_CAPACITY_M3 },
  ];
  const cycles: DryingCycle[] = [];
  const result = createInquiry(
    { species: "dub", volumeM3: 5, inputMoisturePct: 55, targetBand: "6-8", thicknessMm: 50, lumberKind: "fosny" },
    "B2C",
    chambers,
    cycles,
    "2026-06-02T08:00:00Z",
  );
  console.log(JSON.stringify(result, null, 2));
}
