import Fastify from "fastify";
import cors from "@fastify/cors";
import { initDb } from "./db.js";
import { calculatorRoutes } from "./routes/calculator.js";
import { inquiryRoutes } from "./routes/inquiries.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: "*" });

// Inicializace DB při startu
initDb();

// Routes
await app.register(calculatorRoutes);
await app.register(inquiryRoutes);
await app.register(adminRoutes);

// Health check
app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));

try {
  const port = parseInt(process.env.PORT ?? "3000");
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`\n✅ Backend běží na portu ${port}`);
  console.log("📋 Admin API: /api/inquiries\n");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
