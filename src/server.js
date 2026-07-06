import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { getPool } from "./config/db.js";
import { auth } from "./middleware/auth.js";
import { idempotency } from "./middleware/idempotency.js";
import { errorHandler } from "./middleware/errorHandler.js";
import productsRoutes from "./routes/products.routes.js";
import invoicesRoutes from "./routes/invoices.routes.js";
import orderRoutes from "./routes/order.routes.js";
import { openapiSpec } from "./docs/openapi.js";

// ---------------------------------------------------------------------------
// Boot check: fail fast if the DB isn't reachable.
// ---------------------------------------------------------------------------
async function assertDb() {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    console.log("[db] connected to", env.db.database);
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  }
}

function buildApp() {
  const app = express();

  // CORS � allow all origins for the API
  app.use(cors());

  // Serve static files (workflow diagram, etc.)
  app.use(express.static('public'));
  

  // Body parsing — only JSON, reasonable size cap.
  app.use(express.json({ limit: "2mb" }));

  // Health check (no auth) — useful for load balancers / uptime checks.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/openapi.json", (_req, res) => res.json(openapiSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  // All integration endpoints require auth + (optionally) idempotency.
  app.use(
    "/rest/V1/integrations/shopmaster/products",
    auth,
    idempotency,
    productsRoutes
  );

  // Purchase & Sales invoice endpoints
  app.use(
    "/rest/V1/integrations/shopmaster",
    auth,
    invoicesRoutes
  );

  // Order email notifications
  app.use(
    "/rest/V1/integrations/shopmaster",
    auth,
    orderRoutes
  );

  // 404 for anything else under the API root.
  app.use("/rest", (_req, res) =>
    res.status(404).json({ success: false, message: "Not found." })
  );

  // Central error handler — mounted LAST.
  app.use(errorHandler);

  return app;
}

async function start() {
  await assertDb();
  const app = buildApp();
  app.listen(env.port, () => {
    console.log(`[server] Shopmaster Product API listening on :${env.port}`);
  });
}

// Top-level error safety net.
process.on("unhandledRejection", (err) =>
  console.error("[unhandledRejection]", err)
);

start();
