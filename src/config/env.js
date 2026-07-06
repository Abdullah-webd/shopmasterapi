import dotenv from "dotenv";

dotenv.config();

function required(key) {
  const v = process.env[key];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v.trim();
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  integrationToken: required("INTEGRATION_TOKEN"),
  db: {
    server: required("DB_SERVER"),
    instance: process.env.DB_INSTANCE?.trim() || null,
    database: required("DB_DATABASE"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    port:
      process.env.DB_PORT && process.env.DB_PORT.trim() !== ""
        ? Number(process.env.DB_PORT)
        : null,
    encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    trustServerCertificate:
      String(process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() ===
      "true",
    poolMax: Number(process.env.DB_POOL_MAX || 10),
    poolIdleTimeoutMs: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 30000),
  },
  idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 24),
  imageDownloadDir: process.env.IMAGE_DOWNLOAD_DIR || "./storage/images",
};
