import type { OrderParams } from "../domain/types.js";
import { TARGET_BAND_MIDPOINT, SPECIES_HARDNESS } from "../domain/types.js";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Neplatné vstupy: ${issues.join("; ")}`);
    this.name = "ValidationError";
  }
}

const VALID_SPECIES = new Set(Object.keys(SPECIES_HARDNESS));
const VALID_BANDS = new Set(Object.keys(TARGET_BAND_MIDPOINT));
const VALID_KINDS = new Set(["fosny", "hranoly", "prkna"]);

/**
 * Validuje vstupy z konfigurátoru. Edge cases ze zadání:
 * - objem nesmí přesáhnout kapacitu komory (řeší planner, tady jen kladnost),
 * - vstupní vlhkost musí být > cílová (jinak není co sušit),
 * - tloušťka v rozumném rozsahu (chrání před extrémy ve výpočtu času).
 */
export function validateOrderParams(p: Partial<OrderParams>): asserts p is OrderParams {
  const issues: string[] = [];

  if (!p.species || !VALID_SPECIES.has(p.species)) issues.push("neznámý druh dřeva");
  if (!p.targetBand || !VALID_BANDS.has(p.targetBand)) issues.push("neplatné cílové pásmo");
  if (!p.lumberKind || !VALID_KINDS.has(p.lumberKind)) issues.push("neplatný druh řeziva");

  if (typeof p.volumeM3 !== "number" || !(p.volumeM3 > 0))
    issues.push("objem musí být kladný");
  if (typeof p.volumeM3 === "number" && p.volumeM3 > 20)
    issues.push("objem přesahuje kapacitu komory (20 m³)");

  if (typeof p.inputMoisturePct !== "number" || p.inputMoisturePct < 0 || p.inputMoisturePct > 100)
    issues.push("vstupní vlhkost mimo rozsah 0–100 %");

  if (typeof p.thicknessMm !== "number" || !(p.thicknessMm > 0) || p.thicknessMm > 200)
    issues.push("tloušťka mimo rozumný rozsah 1–200 mm");

  // Vstupní vlhkost musí být vyšší než cíl, jinak nedává smysl sušit.
  if (
    p.targetBand &&
    typeof p.inputMoisturePct === "number" &&
    p.inputMoisturePct <= TARGET_BAND_MIDPOINT[p.targetBand]
  ) {
    issues.push("vstupní vlhkost není vyšší než cílová — není co sušit");
  }

  if (issues.length > 0) throw new ValidationError(issues);
}
