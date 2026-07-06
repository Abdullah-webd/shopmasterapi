import sql from "mssql";
import { env } from "./env.js";

// One shared connection pool for the whole app.
// Per-request connections would be wasteful and slow.
let poolPromise = null;

function normalizeServerConfig() {
  const [host, parsedInstance] = env.db.server.split("\\");
  const instanceName = env.db.instance || parsedInstance || null;

  const config = {
    server: host,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
    options: {
      encrypt: env.db.encrypt,
      trustServerCertificate: env.db.trustServerCertificate,
      enableArithAbort: true,
    },
    pool: {
      max: env.db.poolMax,
      min: 0,
      idleTimeoutMillis: env.db.poolIdleTimeoutMs,
    },
  };

  if (env.db.port) {
    config.port = env.db.port;
  } else if (instanceName) {
    config.options.instanceName = instanceName;
  } else {
    config.port = 1433;
  }

  return config;
}

export function getPool() {
  if (!poolPromise) {
    const config = normalizeServerConfig();

    poolPromise = sql.connect(config).catch((err) => {
      // Reset so the next call tries again instead of caching the failure.
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

export { sql };
