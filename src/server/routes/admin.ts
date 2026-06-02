import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

export async function adminRoutes(app: FastifyInstance) {
  /** GET /api/admin/stats — přehled pro dashboard */
  app.get("/api/admin/stats", async () => {
    const total = (db.prepare("SELECT COUNT(*) as n FROM wood_order").get() as { n: number }).n;
    const byStatus = db.prepare(
      "SELECT status, COUNT(*) as n FROM wood_order GROUP BY status"
    ).all() as { status: string; n: number }[];
    const chambers = db.prepare("SELECT * FROM chamber").all();
    const activeCycles = db.prepare(
      "SELECT dc.*, c.capacity_m3 FROM drying_cycle dc JOIN chamber c ON c.id = dc.chamber_id WHERE dc.status IN ('PLANOVANY','BEZICI') ORDER BY dc.starts_at"
    ).all();
    return { total, byStatus, chambers, activeCycles };
  });

  /** GET /api/admin/chambers — komory a jejich cykly */
  app.get("/api/admin/chambers", async () => {
    const chambers = db.prepare("SELECT * FROM chamber").all();
    const cycles = db.prepare(
      "SELECT dc.*, COUNT(o.id) as order_count FROM drying_cycle dc LEFT JOIN wood_order o ON o.cycle_id = dc.id GROUP BY dc.id ORDER BY dc.starts_at DESC"
    ).all();
    return { chambers, cycles };
  });

  /** POST /api/admin/cycles — vytvoření nového sušicího cyklu */
  app.post<{
    Body: {
      chamberId: string;
      species: string;
      targetBand: string;
      thicknessMm: number;
      startsAt: string;
      endsAt: string;
    };
  }>("/api/admin/cycles", async (req, reply) => {
    const { chamberId, species, targetBand, thicknessMm, startsAt, endsAt } = req.body;
    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    db.prepare(
      "INSERT INTO drying_cycle (id, chamber_id, species, target_band, thickness_mm, starts_at, ends_at) VALUES (?,?,?,?,?,?,?)"
    ).run(id, chamberId, species, targetBand, thicknessMm, startsAt, endsAt);
    return reply.status(201).send({ id });
  });

  /** PATCH /api/admin/orders/:id/cycle — přiřazení zakázky k cyklu */
  app.patch<{ Params: { id: string }; Body: { cycleId: string } }>(
    "/api/admin/orders/:id/cycle",
    async (req, reply) => {
      const { cycleId } = req.body;
      const order = db.prepare("SELECT volume_m3 FROM wood_order WHERE id = ?").get(req.params.id) as { volume_m3: number } | undefined;
      if (!order) return reply.status(404).send({ error: "Zakázka nenalezena" });

      const cycle = db.prepare(
        "SELECT dc.*, c.capacity_m3 FROM drying_cycle dc JOIN chamber c ON c.id = dc.chamber_id WHERE dc.id = ?"
      ).get(cycleId) as { used_m3: number; capacity_m3: number } | undefined;
      if (!cycle) return reply.status(404).send({ error: "Cyklus nenalezen" });

      if (cycle.used_m3 + order.volume_m3 > cycle.capacity_m3) {
        return reply.status(400).send({ error: "Nedostatek kapacity v cyklu." });
      }

      db.transaction(() => {
        db.prepare("UPDATE wood_order SET cycle_id = ? WHERE id = ?").run(cycleId, req.params.id);
        db.prepare("UPDATE drying_cycle SET used_m3 = used_m3 + ? WHERE id = ?").run(order.volume_m3, cycleId);
      })();

      return { ok: true };
    }
  );
}
