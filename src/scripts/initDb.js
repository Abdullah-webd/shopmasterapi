// ============================================================================
// Database initializer.
//
// Reads db/schema.sql, splits it on `GO` batch separators, and runs each
// batch against SQL Server using the .env credentials. Idempotent — safe to
// run repeatedly.
//
//   node src/scripts/initDb.js        (or)   npm run db:init
//
// ============================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql, getPool } from "../config/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, "..", "..", "db", "schema.sql");

function splitBatches(sqlText) {
  // Split on lines that are exactly "GO" (case-insensitive, optional trailing
  // whitespace/semicolon). This matches what sqlcmd / SSMS treat as a batch
  // separator.
  const lines = sqlText.split(/\r?\n/);
  const batches = [];
  let current = [];

  const goRe = /^\s*go\s*;?\s*$/i;

  for (const line of lines) {
    if (goRe.test(line)) {
      const batch = current.join("\n").trim();
      if (batch) batches.push(batch);
      current = [];
    } else {
      current.push(line);
    }
  }
  const tail = current.join("\n").trim();
  if (tail) batches.push(tail);
  return batches;
}

async function main() {
  console.log("→ Reading schema file:", SCHEMA_PATH);
  const sqlText = readFileSync(SCHEMA_PATH, "utf8");
  const batches = splitBatches(sqlText);
  console.log(`→ Found ${batches.length} batches.`);

  console.log("→ Connecting to SQL Server…");
  const pool = await getPool();
  console.log(`→ Connected to database: ${pool.config.database}\n`);

  let executed = 0;
  let skipped = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    // Give each batch a short label for logging (first non-comment line).
    const labelLine = batch
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("--"));
    const label = (labelLine || "(empty)").slice(0, 70);

    try {
      // Each batch is wrapped in IF ... BEGIN ... END where appropriate, so
      // re-running is safe. request() runs the batch as one statement group.
      const req = pool.request();
      await req.query(batch);
      executed++;
      console.log(`  [${String(i + 1).padStart(2, "0")}/ok ] ${label}`);
    } catch (err) {
      // Benign re-run errors: object already exists, constraint already exists.
      const msg = (err.message || "").toLowerCase();
      const benign =
        msg.includes("there is already an object") ||
        msg.includes("already an object named") ||
        msg.includes("constraint") && msg.includes("already") ||
        msg.includes("statement has been terminated");

      if (benign) {
        skipped++;
        console.log(`  [${String(i + 1).padStart(2, "0")}/skip] ${label}`);
      } else {
        console.error(`\n✗ Batch ${i + 1} failed:`);
        console.error(`  ${label}`);
        console.error(`  ${err.message}\n`);
        throw err;
      }
    }
  }

  // Sanity check: count the tables we expect.
  const countResult = await pool.request().query(
    `SELECT COUNT(*) AS n
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'`
  );
  const tableCount = countResult.recordset[0].n;

  console.log(
    `\n✓ Done. Executed ${executed} batch(es), skipped ${skipped} on re-run.`
  );
  console.log(`✓ dbo tables in this database: ${tableCount}`);

  await pool.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Database init failed:", err.message);
  process.exit(1);
});
