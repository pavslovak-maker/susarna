import Fastify from "fastify";
import cors from "@fastify/cors";
import { initDb } from "./db.js";
import { calculatorRoutes } from "./routes/calculator.js";
import { inquiryRoutes } from "./routes/inquiries.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: "http://localhost:5173" });

// Inicializace DB při startu
initDb();

// Routes
await app.register(calculatorRoutes);
await app.register(inquiryRoutes);
await app.register(adminRoutes);

// Health check
app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));

try {
  await app.listen({ port: 3000, host: "127.0.0.1" });
  console.log("\n✅ Backend běží na http://localhost:3000");
  console.log("📋 Admin API: http://localhost:3000/api/inquiries\n");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
