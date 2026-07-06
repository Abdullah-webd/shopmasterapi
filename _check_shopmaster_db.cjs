const sql = require("mssql");

async function check() {
  const pool = await sql.connect({
    server: "80.64.217.76",
    port: 1433,
    database: "SBasic000",
    user: "mds2073",
    password: "185mdM%1u",
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
  });

  console.log("Connected to SBasic000.\n");

  // 1. All tables
  const r = await pool.request().query(`
    SELECT TABLE_NAME, TABLE_TYPE, CREATE_DATE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_TYPE, TABLE_NAME
  `);

  console.log("=== ALL dbo TABLES IN SBasic000 ===");
  if (r.recordset.length === 0) {
    console.log("(none)");
  } else {
    r.recordset.forEach((row) =>
      console.log(
        row.TABLE_TYPE.padEnd(12),
        row.TABLE_NAME.padEnd(40),
        row.CREATE_DATE.toISOString().slice(0, 19).replace("T", " ")
      )
    );
  }

  // 2. Specifically the shopmaster tables
  console.log("\n=== SHOPMASTER TABLES (checking if they exist) ===");
  const shopmasterNames = [
    "brands", "categories", "skin_types", "locations", "tags",
    "products", "product_categories", "product_skin_types", "product_tags",
    "inventory", "inventory_locations", "product_images", "idempotency_keys"
  ];
  for (const name of shopmasterNames) {
    const exists = r.recordset.some((t) => t.TABLE_NAME === name);
    console.log(
      exists ? "  EXISTS    " : "  MISSING   ",
      name
    );
  }

  console.log("\nTotal tables in SBasic000 (dbo):", r.recordset.length);

  await pool.close();
}

check().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
