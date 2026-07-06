import sql from "mssql";
import { env } from "../config/env.js";

const [host, parsedInstance] = env.db.server.split("\\");
const instanceName = env.db.instance || parsedInstance || null;

function baseConfig(label) {
  return {
    label,
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
      max: 1,
      min: 0,
      idleTimeoutMillis: 5000,
    },
    connectionTimeout: 15000,
    requestTimeout: 15000,
  };
}

const attempts = [];

if (env.db.port) {
  attempts.push({
    ...baseConfig(`host + port ${env.db.port}`),
    port: env.db.port,
  });
}

if (instanceName) {
  const config = baseConfig(`named instance ${instanceName}`);
  attempts.push({
    ...config,
    options: {
      ...config.options,
      instanceName,
    },
  });
}

if (!attempts.length) {
  attempts.push({
    ...baseConfig("default port 1433"),
    port: 1433,
  });
}

for (const config of attempts) {
  const { label, ...connectConfig } = config;
  console.log(`\n[db:check] Trying ${label}...`);
  const pool = new sql.ConnectionPool(connectConfig);
  try {
    await pool.connect();
    const result = await pool.request().query(`
      SELECT
        @@SERVERNAME AS server_name,
        DB_NAME() AS database_name,
        SYSTEM_USER AS login_name
    `);
    console.log("[db:check] SUCCESS");
    console.log(result.recordset[0]);
  } catch (err) {
    console.log("[db:check] FAILED");
    console.log(`${err.code || "ERROR"}: ${err.message}`);
  } finally {
    await pool.close().catch(() => {});
  }
}
