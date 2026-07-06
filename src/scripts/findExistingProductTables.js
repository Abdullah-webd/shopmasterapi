import { getPool } from "../config/db.js";

const pool = await getPool();

const result = await pool.request().query(`
  SELECT
    t.name AS table_name,
    t.create_date,
    COUNT(c.column_id) AS column_count
  FROM sys.tables t
  INNER JOIN sys.columns c ON c.object_id = t.object_id
  WHERE t.schema_id = SCHEMA_ID('dbo')
    AND (
      t.name LIKE '%prod%'
      OR t.name LIKE '%item%'
      OR t.name LIKE '%stock%'
      OR t.name LIKE '%invent%'
      OR t.name LIKE '%category%'
      OR t.name LIKE '%brand%'
      OR t.name LIKE '%image%'
    )
  GROUP BY t.name, t.create_date
  ORDER BY t.name;
`);

console.table(
  result.recordset.map((row) => ({
    table: row.table_name,
    columns: row.column_count,
    created: row.create_date.toISOString(),
  }))
);

await pool.close();
