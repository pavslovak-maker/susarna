import type { FastifyInstance } from "fastify";
import { validateOrderParams } from "../../domain/validation.js";
import { calculate } from "../../calc/calculator.js";
import { findPlacements } from "../../planning/planner.js";
import { DEFAULT_PRICING } from "../../calc/pricingConfig.js";
import { db } from "../db.js";
import type { Chamber, DryingCycle } from "../../planning/planner.js";
import type { CustomerType } from "../../domain/types.js";

export async function calculatorRoutes(app: FastifyInstance) {
  /**
   * POST /api/calculate
   * Preview výpočtu — bez uložení do DB.
   * Vrátí odhad času, ceny a dostupné termíny.
   */
  app.post<{ Body: Record<string, unknown> }>("/api/calculate", async (req, reply) => {
    const { customerType = "B2C", ...params } = req.body as Record<string, unknown>;

    try {
      validateOrderParams(params);
    } catch (err: unknown) {
      const e = err as { name?: string; issues?: unknown };
      if (e.name === "ValidationError") {
        return reply.status(400).send({ error: "Neplatné parametry", issues: e.issues });
      }
      throw err;
    }

    const cfg = JSON.parse(
      (db.prepare("SELECT config FROM pricing_config ORDER BY version DESC LIMIT 1").get() as { config: string }).config
    );

    const chambers = db.prepare("SELECT * FROM chamber").all() as Chamber[];
    const cycles = db.prepare(
      "SELECT * FROM drying_cycle WHERE status IN ('PLANOVANY','BEZICI')"
    ).all() as DryingCycle[];

    const now = new Date().toISOString();
    const result = calculate(params as Parameters<typeof calculate>[0], cfg, customerType as CustomerType);
    const placements = findPlacements(params as Parameters<typeof calculate>[0], chambers, cycles, now);

    const expectedFinish = placements[0]
      ? new Date(Date.parse(placements[0].earliestStart) + result.duration.days * 86_400_000).toISOString()
      : null;

    return {
      duration: result.duration,
      price: {
        display: result.displayPrice,
        withVat: result.displayWithVat,
        net: result.price.netPrice,
        vat: result.price.vat,
        gross: result.price.grossPrice,
        minPriceApplied: result.price.minPriceApplied,
      },
      placements: placements.slice(0, 3),
      expectedFinish,
      pricingVersion: result.pricingVersion,
      note: "Nezávazný odhad",
    };
  });
}
