import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { validateOrderParams } from "../../domain/validation.js";
import { calculate } from "../../calc/calculator.js";
import type { CustomerType, OrderParams } from "../../domain/types.js";

export async function inquiryRoutes(app: FastifyInstance) {
  /**
   * POST /api/inquiries
   * Uloží poptávku + zákazníka do DB.
   */
  app.post<{ Body: Record<string, unknown> }>("/api/inquiries", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const {
      customerType = "B2C",
      name, email, phone, ico, dic,
      ...params
    } = body;

    // Validace parametrů zakázky
    try {
      validateOrderParams(params);
    } catch (err: unknown) {
      const e = err as { name?: string; issues?: unknown };
      if (e.name === "ValidationError") {
        return reply.status(400).send({ error: "Neplatné parametry", issues: e.issues });
      }
      throw err;
    }

    if (!name || !email) {
      return reply.status(400).send({ error: "Jméno a e-mail jsou povinné." });
    }

    const cfg = JSON.parse(
      (db.prepare("SELECT config FROM pricing_config ORDER BY version DESC LIMIT 1").get() as { config: string }).config
    );

    const calc = calculate(params as OrderParams, cfg, customerType as CustomerType);

    const insertCustomer = db.prepare(`
      INSERT INTO customer (id, type, name, email, phone, ico, dic)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertOrder = db.prepare(`
      INSERT INTO wood_order
        (id, customer_id, species, volume_m3, input_moisture_pct, target_band,
         thickness_mm, lumber_kind, estimated_days, net_price_czk, pricing_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertHistory = db.prepare(`
      INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
      VALUES (?, NULL, 'POPTAVKA', 'system')
    `);

    const customerId = randomUUID();
    const orderId = randomUUID();

    db.transaction(() => {
      insertCustomer.run(
        customerId, customerType,
        name, email, phone ?? null, ico ?? null, dic ?? null
      );
      insertOrder.run(
        orderId, customerId,
        params.species, params.volumeM3, params.inputMoisturePct, params.targetBand,
        params.thicknessMm, params.lumberKind,
        calc.duration.days, calc.price.netPrice, calc.pricingVersion
      );
      insertHistory.run(orderId);
    })();

    return reply.status(201).send({
      orderId,
      estimatedDays: calc.duration.days,
      displayPrice: calc.displayPrice,
      withVat: calc.displayWithVat,
      message: "Poptávka přijata. Provozovatel vás brzy kontaktuje.",
    });
  });

  /**
   * GET /api/inquiries
   * Seznam všech poptávek pro admin.
   */
  app.get("/api/inquiries", async () => {
    const rows = db.prepare(`
      SELECT
        o.id, o.status, o.species, o.volume_m3, o.target_band,
        o.thickness_mm, o.lumber_kind, o.input_moisture_pct,
        o.estimated_days, o.net_price_czk, o.created_at,
        c.name as customer_name, c.email as customer_email,
        c.phone as customer_phone, c.type as customer_type,
        c.ico, c.dic
      FROM wood_order o
      JOIN customer c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
    `).all();
    return rows;
  });

  /**
   * GET /api/inquiries/:id
   * Detail zakázky.
   */
  app.get<{ Params: { id: string } }>("/api/inquiries/:id", async (req, reply) => {
    const row = db.prepare(`
      SELECT o.*, c.name as customer_name, c.email as customer_email,
             c.phone as customer_phone, c.type as customer_type, c.ico, c.dic
      FROM wood_order o JOIN customer c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!row) return reply.status(404).send({ error: "Zakázka nenalezena" });

    const history = db.prepare(
      "SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at"
    ).all(req.params.id);

    return { ...row, history };
  });

  /**
   * PATCH /api/inquiries/:id/status
   * Změna stavu zakázky (admin).
   */
  app.patch<{ Params: { id: string }; Body: { status: string; changedBy?: string } }>(
    "/api/inquiries/:id/status",
    async (req, reply) => {
      const { status: newStatus, changedBy = "admin" } = req.body;
      const order = db.prepare("SELECT status FROM wood_order WHERE id = ?").get(req.params.id) as { status: string } | undefined;

      if (!order) return reply.status(404).send({ error: "Zakázka nenalezena" });

      // Import workflow dynamicky aby nedošlo k circular deps
      const { canTransition } = await import("../../domain/workflow.js");
      if (!canTransition(order.status as Parameters<typeof canTransition>[0], newStatus as Parameters<typeof canTransition>[1])) {
        return reply.status(400).send({
          error: `Přechod ${order.status} → ${newStatus} není povolen.`,
        });
      }

      db.transaction(() => {
        db.prepare("UPDATE wood_order SET status = ? WHERE id = ?").run(newStatus, req.params.id);
        db.prepare(
          "INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?,?,?,?)"
        ).run(req.params.id, order.status, newStatus, changedBy);
      })();

      return { ok: true, newStatus };
    }
  );
}
