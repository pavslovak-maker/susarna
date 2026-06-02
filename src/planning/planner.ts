import type {
  OrderParams,
  WoodSpecies,
  TargetMoistureBand,
  CycleStatus,
} from "../domain/types.js";
import { SPECIES_HARDNESS } from "../domain/types.js";

/**
 * PLÁNOVÁNÍ KAPACITY — nejsložitější část (zadání kap. 6).
 *
 * Vědomé zjednodušení pro daný provoz (2 komory × 20 m³, ruční schvalování):
 * NEděláme automatický optimální bin-packing (NP-těžké, zbytečné pro 2 komory).
 * Místo toho systém NAVRHUJE: ke které kompatibilní vsázce lze zakázku připojit,
 * nebo zda založit novou. Finální rozhodnutí dělá provozovatel ručně.
 *
 * Tím odpadá i těžký concurrency problém: kapacita se „uzamkne“ až schválením
 * (POPTAVKA → POTVRZENO), kde stačí jedna DB transakce s kontrolou volného místa.
 */

export const CHAMBER_CAPACITY_M3 = 20;

export interface Chamber {
  id: string;
  capacityM3: number;
  /** Druhy, které komora umí sušit; prázdné = univerzální. */
  allowedSpecies?: WoodSpecies[];
}

export interface DryingCycle {
  id: string;
  chamberId: string;
  status: CycleStatus;
  /** Profil vsázky — definuje, co je s ní kompatibilní. */
  species: WoodSpecies;
  targetBand: TargetMoistureBand;
  /** Reprezentativní tloušťka vsázky v mm. */
  thicknessMm: number;
  /** Plánovaný start a konec (ISO). Konec = start + odhad nejpomalejší zakázky. */
  startsAt: string;
  endsAt: string;
  /** Již obsazený objem v m³. */
  usedM3: number;
}

export interface PlacementOption {
  kind: "JOIN_EXISTING" | "NEW_CYCLE";
  chamberId: string;
  cycleId?: string; // jen u JOIN_EXISTING
  /** Nejbližší možný termín nástupu (ISO). */
  earliestStart: string;
  freeM3: number;
  reason: string;
}

export interface CompatibilityRules {
  /** Maximální rozdíl tloušťky v mm, aby šlo míchat do jedné vsázky. */
  maxThicknessDeltaMm: number;
}

export const DEFAULT_COMPATIBILITY: CompatibilityRules = {
  maxThicknessDeltaMm: 15,
};

/**
 * Kompatibilita zakázky s běžící/plánovanou vsázkou (kap. 6.1):
 * stejný druh, stejné cílové pásmo, podobná tloušťka, a stejná tvrdost
 * (nelze míchat dub a smrk — to pokrývá už shoda druhu, tvrdost je pojistka).
 */
export function isCompatible(
  params: OrderParams,
  cycle: DryingCycle,
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY,
): boolean {
  if (cycle.status !== "PLANOVANY") return false; // připojit lze jen před startem
  if (cycle.species !== params.species) return false;
  if (cycle.targetBand !== params.targetBand) return false;
  if (SPECIES_HARDNESS[cycle.species] !== SPECIES_HARDNESS[params.species]) return false;
  if (Math.abs(cycle.thicknessMm - params.thicknessMm) > rules.maxThicknessDeltaMm) return false;
  return true;
}

function freeCapacity(chamber: Chamber, cycle: DryingCycle): number {
  return chamber.capacityM3 - cycle.usedM3;
}

function chamberAllowsSpecies(chamber: Chamber, species: WoodSpecies): boolean {
  return !chamber.allowedSpecies || chamber.allowedSpecies.includes(species);
}

/**
 * Vrátí seřazené možnosti umístění zakázky (nejlepší první).
 * Preferuje připojení k existující vsázce (vyšší vytíženost, kratší čekání).
 *
 * @param now referenční čas (ISO) — injektovaný kvůli testovatelnosti
 */
export function findPlacements(
  params: OrderParams,
  chambers: Chamber[],
  cycles: DryingCycle[],
  now: string,
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY,
): PlacementOption[] {
  const options: PlacementOption[] = [];

  // 1) Připojení ke kompatibilní plánované vsázce s dostatečným místem.
  for (const cycle of cycles) {
    if (!isCompatible(params, cycle, rules)) continue;
    const chamber = chambers.find((c) => c.id === cycle.chamberId);
    if (!chamber) continue;
    const free = freeCapacity(chamber, cycle);
    if (free < params.volumeM3) continue;

    options.push({
      kind: "JOIN_EXISTING",
      chamberId: chamber.id,
      cycleId: cycle.id,
      earliestStart: cycle.startsAt,
      freeM3: free - params.volumeM3,
      reason: `Připojení ke kompatibilní vsázce (druh ${cycle.species}, cíl ${cycle.targetBand})`,
    });
  }

  // 2) Nová vsázka v komoře, která bude nejdřív volná.
  for (const chamber of chambers) {
    if (!chamberAllowsSpecies(chamber, params.species)) continue;
    if (params.volumeM3 > chamber.capacityM3) continue; // nevejde se ani sama

    const earliest = earliestFreeSlot(chamber, cycles, now);
    options.push({
      kind: "NEW_CYCLE",
      chamberId: chamber.id,
      earliestStart: earliest,
      freeM3: chamber.capacityM3 - params.volumeM3,
      reason: `Nová vsázka v komoře ${chamber.id}`,
    });
  }

  // Řazení s preferencí vytíženosti: připojení k existující vsázce má přednost,
  // pokud jeho nástup není výrazně později (max o JOIN_PREFERENCE_DAYS) než
  // nejdřívější nová vsázka. Jinak rozhoduje dřívější termín nástupu.
  const earliestNew = options
    .filter((o) => o.kind === "NEW_CYCLE")
    .map((o) => o.earliestStart)
    .sort()[0];

  return options.sort((a, b) => {
    const aAdj = adjustedSortKey(a, earliestNew);
    const bAdj = adjustedSortKey(b, earliestNew);
    const t = aAdj.localeCompare(bAdj);
    if (t !== 0) return t;
    if (a.kind === b.kind) return a.earliestStart.localeCompare(b.earliestStart);
    return a.kind === "JOIN_EXISTING" ? -1 : 1;
  });
}

/** Kolik dní zpoždění připojení je ještě akceptovatelné kvůli vytížení. */
const JOIN_PREFERENCE_DAYS = 7;

/**
 * Pro řazení: pokud je JOIN do JOIN_PREFERENCE_DAYS od nejlepší nové vsázky,
 * „posuneme“ jeho klíč na úroveň nové vsázky, aby preference vytížení rozhodla.
 */
function adjustedSortKey(o: PlacementOption, earliestNew: string | undefined): string {
  if (o.kind !== "JOIN_EXISTING" || !earliestNew) return o.earliestStart;
  const diffDays =
    (Date.parse(o.earliestStart) - Date.parse(earliestNew)) / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= JOIN_PREFERENCE_DAYS ? earliestNew : o.earliestStart;
}

/**
 * Nejbližší volný slot v komoře = konec poslední neukončené vsázky,
 * nebo `now`, pokud je komora volná.
 */
function earliestFreeSlot(chamber: Chamber, cycles: DryingCycle[], now: string): string {
  const active = cycles
    .filter((c) => c.chamberId === chamber.id && (c.status === "PLANOVANY" || c.status === "BEZICI"))
    .map((c) => c.endsAt)
    .sort();
  const last = active.at(-1);
  return last && last > now ? last : now;
}
