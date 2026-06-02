import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, estimateDuration, calculatePrice } from "../src/calc/calculator.js";
import { DEFAULT_PRICING } from "../src/calc/pricingConfig.js";
import type { OrderParams } from "../src/domain/types.js";

const cfg = DEFAULT_PRICING;

const dubFurniture: OrderParams = {
  species: "dub",
  volumeM3: 5,
  inputMoisturePct: 55,
  targetBand: "6-8",
  thicknessMm: 50,
  lumberKind: "fosny",
};

const smrkConstruction: OrderParams = {
  species: "smrk",
  volumeM3: 8,
  inputMoisturePct: 35,
  targetBand: "12-15",
  thicknessMm: 25,
  lumberKind: "prkna",
};

test("tvrdé dřevo schne déle než měkké za jinak srovnatelných podmínek", () => {
  const hard = estimateDuration({ ...dubFurniture, inputMoisturePct: 40, targetBand: "12-15", thicknessMm: 25 }, cfg);
  const soft = estimateDuration({ ...smrkConstruction, inputMoisturePct: 40, thicknessMm: 25 }, cfg);
  assert.ok(hard.days > soft.days, `dub ${hard.days} by měl být > smrk ${soft.days}`);
});

test("silnější řezivo schne nelineárně déle", () => {
  const thin = estimateDuration({ ...dubFurniture, thicknessMm: 25 }, cfg);
  const thick = estimateDuration({ ...dubFurniture, thicknessMm: 50 }, cfg);
  // Dvojnásobná tloušťka → více než dvojnásobný nárůst „čisté“ části (před rezervou).
  const thinNet = thin.days - cfg.safetyMarginDays;
  const thickNet = thick.days - cfg.safetyMarginDays;
  assert.ok(thickNet > thinNet * 2, `nelineární: ${thinNet} → ${thickNet}`);
});

test("odhad obsahuje rozsah min–max kolem střední hodnoty", () => {
  const d = estimateDuration(dubFurniture, cfg);
  assert.ok(d.minDays <= d.days && d.days <= d.maxDays);
  assert.ok(d.minDays >= 1);
});

test("nižší cílová vlhkost = vyšší cena", () => {
  const furniture = calculatePrice({ ...dubFurniture, targetBand: "6-8" }, cfg, "B2B");
  const building = calculatePrice({ ...dubFurniture, targetBand: "12-15" }, cfg, "B2B");
  assert.ok(furniture.netPrice > building.netPrice);
});

test("B2C vidí cenu s DPH, B2B bez DPH", () => {
  const b2c = calculate(dubFurniture, cfg, "B2C");
  const b2b = calculate(dubFurniture, cfg, "B2B");
  assert.equal(b2c.displayWithVat, true);
  assert.equal(b2b.displayWithVat, false);
  assert.equal(b2c.displayPrice, b2c.price.grossPrice);
  assert.equal(b2b.displayPrice, b2b.price.netPrice);
  assert.ok(b2c.displayPrice > b2b.displayPrice);
});

test("minimální cena zakázky se uplatní u malého objemu", () => {
  const tiny = calculatePrice(
    { species: "smrk", volumeM3: 0.2, inputMoisturePct: 35, targetBand: "12-15", thicknessMm: 20, lumberKind: "prkna" },
    cfg,
    "B2B",
  );
  assert.equal(tiny.minPriceApplied, true);
  assert.equal(tiny.netPrice, cfg.minOrderPriceCzk);
});

test("množstevní sleva se aplikuje od prahu", () => {
  const small = calculatePrice({ ...smrkConstruction, volumeM3: 5 }, cfg, "B2B");
  const big = calculatePrice({ ...smrkConstruction, volumeM3: 18 }, cfg, "B2B");
  // Jednotková cena za m³ má u velkého objemu klesnout díky slevě.
  assert.ok(big.netPrice / 18 < small.netPrice / 5);
});

test("cena je zaokrouhlena nahoru na celé koruny", () => {
  const r = calculatePrice(dubFurniture, cfg, "B2C");
  assert.equal(r.netPrice, Math.ceil(r.netPrice));
  assert.equal(r.vat, Math.ceil(r.vat));
});

test("výpočet ukládá verzi koeficientů pro audit", () => {
  const r = calculate(dubFurniture, cfg, "B2B");
  assert.equal(r.pricingVersion, cfg.version);
});
