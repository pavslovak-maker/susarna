import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOrderParams, ValidationError } from "../src/domain/validation.js";
import { canTransition, assertTransition, isFinal, IllegalTransitionError } from "../src/domain/workflow.js";
import { findPlacements, isCompatible, CHAMBER_CAPACITY_M3 } from "../src/planning/planner.js";
import type { OrderParams } from "../src/domain/types.js";
import type { Chamber, DryingCycle } from "../src/planning/planner.js";

const valid: OrderParams = {
  species: "dub",
  volumeM3: 5,
  inputMoisturePct: 55,
  targetBand: "6-8",
  thicknessMm: 50,
  lumberKind: "fosny",
};

// --- Validace ---
test("validní vstupy projdou", () => {
  assert.doesNotThrow(() => validateOrderParams({ ...valid }));
});

test("objem nad kapacitu komory selže", () => {
  assert.throws(() => validateOrderParams({ ...valid, volumeM3: 25 }), ValidationError);
});

test("vstupní vlhkost nižší než cíl selže", () => {
  assert.throws(() => validateOrderParams({ ...valid, inputMoisturePct: 5 }), ValidationError);
});

test("neznámý druh selže", () => {
  assert.throws(() => validateOrderParams({ ...valid, species: "habr" as never }), ValidationError);
});

// --- Workflow ---
test("povolené přechody dle kap. 7.2", () => {
  assert.ok(canTransition("POPTAVKA", "POTVRZENO"));
  assert.ok(canTransition("SUSI", "HOTOVO"));
  assert.ok(canTransition("HOTOVO", "ZRUSENO"));
});

test("nepovolený skok vyhodí chybu", () => {
  assert.throws(() => assertTransition("POPTAVKA", "FAKTUROVANO"), IllegalTransitionError);
  assert.equal(canTransition("FAKTUROVANO", "POPTAVKA"), false);
});

test("finální stavy nemají další přechod", () => {
  assert.ok(isFinal("FAKTUROVANO"));
  assert.ok(isFinal("ZRUSENO"));
  assert.equal(isFinal("SUSI"), false);
});

// --- Planning ---
const chambers: Chamber[] = [
  { id: "K1", capacityM3: CHAMBER_CAPACITY_M3 },
  { id: "K2", capacityM3: CHAMBER_CAPACITY_M3 },
];

const NOW = "2026-06-02T08:00:00Z";

test("kompatibilní vsázka: stejný druh, pásmo, podobná tloušťka", () => {
  const cycle: DryingCycle = {
    id: "C1", chamberId: "K1", status: "PLANOVANY",
    species: "dub", targetBand: "6-8", thicknessMm: 52,
    startsAt: "2026-06-05T08:00:00Z", endsAt: "2026-07-10T08:00:00Z", usedM3: 8,
  };
  assert.ok(isCompatible(valid, cycle));
});

test("nelze míchat tvrdé a měkké dřevo", () => {
  const cycle: DryingCycle = {
    id: "C2", chamberId: "K1", status: "PLANOVANY",
    species: "smrk", targetBand: "6-8", thicknessMm: 50,
    startsAt: "2026-06-05T08:00:00Z", endsAt: "2026-07-10T08:00:00Z", usedM3: 0,
  };
  assert.equal(isCompatible(valid, cycle), false);
});

test("příliš odlišná tloušťka není kompatibilní", () => {
  const cycle: DryingCycle = {
    id: "C3", chamberId: "K1", status: "PLANOVANY",
    species: "dub", targetBand: "6-8", thicknessMm: 100, // delta 50 > 15
    startsAt: "2026-06-05T08:00:00Z", endsAt: "2026-07-10T08:00:00Z", usedM3: 0,
  };
  assert.equal(isCompatible(valid, cycle), false);
});

test("planner preferuje připojení k existující vsázce", () => {
  const cycles: DryingCycle[] = [
    {
      id: "C1", chamberId: "K1", status: "PLANOVANY",
      species: "dub", targetBand: "6-8", thicknessMm: 50,
      startsAt: "2026-06-04T08:00:00Z", endsAt: "2026-07-10T08:00:00Z", usedM3: 10,
    },
  ];
  const opts = findPlacements(valid, chambers, cycles, NOW);
  assert.ok(opts.length >= 2); // join + alespoň jedna nová vsázka
  assert.equal(opts[0].kind, "JOIN_EXISTING");
  assert.equal(opts[0].cycleId, "C1");
});

test("plná kompatibilní vsázka se nenabídne k připojení", () => {
  const cycles: DryingCycle[] = [
    {
      id: "C1", chamberId: "K1", status: "PLANOVANY",
      species: "dub", targetBand: "6-8", thicknessMm: 50,
      startsAt: "2026-06-04T08:00:00Z", endsAt: "2026-07-10T08:00:00Z",
      usedM3: 17, // volných jen 3 m³ < 5 m³
    },
  ];
  const opts = findPlacements(valid, chambers, cycles, NOW);
  assert.equal(opts.some((o) => o.kind === "JOIN_EXISTING"), false);
  assert.ok(opts.every((o) => o.kind === "NEW_CYCLE"));
});

test("obsazená komora posune termín nové vsázky na konec běžícího cyklu", () => {
  const cycles: DryingCycle[] = [
    {
      id: "C1", chamberId: "K1", status: "BEZICI",
      species: "buk", targetBand: "8-11", thicknessMm: 40,
      startsAt: "2026-06-01T08:00:00Z", endsAt: "2026-06-20T08:00:00Z", usedM3: 20,
    },
  ];
  const opts = findPlacements(valid, chambers, cycles, NOW);
  const k1 = opts.find((o) => o.chamberId === "K1")!;
  const k2 = opts.find((o) => o.chamberId === "K2")!;
  assert.equal(k1.earliestStart, "2026-06-20T08:00:00Z"); // čeká na uvolnění
  assert.equal(k2.earliestStart, NOW); // K2 volná hned
});
