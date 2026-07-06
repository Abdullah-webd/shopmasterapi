import { getPool } from "../config/db.js";

const tableNames = [
  "brands",
  "categories",
  "skin_types",
  "locations",
  "tags",
  "products",
  "product_categories",
  "product_skin_types",
  "product_tags",
  "inventory",
  "inventory_locations",
  "product_images",
  "idempotency_keys",
];

const pool = await getPool();
const values = tableNames.map((name) => `('${name}')`).join(",");

const result = await pool.request().query(`
  SELECT
    wanted.name AS table_name,
    tables.create_date,
    tables.modify_date,
    CASE WHEN tables.object_id IS NULL THEN 0 ELSE 1 END AS exists_in_db
  FROM (VALUES ${values}) AS wanted(name)
  LEFT JOIN sys.tables tables
    ON tables.name = wanted.name
   AND tables.schema_id = SCHEMA_ID('dbo')
  ORDER BY wanted.name;
`);

console.table(
  result.recordset.map((row) => ({
    table: row.table_name,
    exists: Boolean(row.exists_in_db),
    created: row.create_date ? row.create_date.toISOString() : null,
    modified: row.modify_date ? row.modify_date.toISOString() : null,
  }))
);

await pool.close();
