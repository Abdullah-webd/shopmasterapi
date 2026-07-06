/**
 * Reads products from existing ProductsTable in SBasic000.
 *
 * Returns the same JSON shape the old code did, but sourced from
 * the single ProductsTable — no JOINs to brands/categories/etc.
 *
 * Fields NOT available from ProductsTable (returned as null/empty):
 *   description, ingredients, how_to_use, weight,
 *   brand, categories, skin_types, tags, images
 */
import { getPool, sql } from "../config/db.js";

export async function listProducts({ page = 1, limit = 50, search } = {}) {
  const pool = await getPool();
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const offset = (safePage - 1) * safeLimit;

  const where = search
    ? `WHERE ProductID LIKE @search OR ProductName LIKE @search OR POSName LIKE @search`
    : "";

  const count = await pool
    .request()
    .input("search", sql.NVarChar(550), search ? `%${search}%` : null)
    .query(`SELECT COUNT(*) AS total FROM dbo.ProductsTable ${where}`);

  const rows = await pool
    .request()
    .input("search", sql.NVarChar(550), search ? `%${search}%` : null)
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, safeLimit)
    .query(`
      SELECT
        ProductID, ProductName, POSName,
        Costprice, SellPrice,
        QtyInStock, ReOrderLevel,
        GroupID, Satus
      FROM dbo.ProductsTable
      ${where}
      ORDER BY ProductID
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  const products = rows.recordset.map((row) => ({
    product_id: row.ProductID,
    external_product_id: row.ProductID,
    external_variant_id: null,
    sku: row.POSName,
    name: row.ProductName,
    status: row.Satus === 1 ? "active" : "inactive",
    price: Number(row.SellPrice ?? 0),
    weight: null,
    description: null,
    ingredients: null,
    how_to_use: null,
    brand: { brand_id: null, name: null },
    categories: [],
    skin_types: [],
    tags: [],
    inventory: {
      stock_qty: Number(row.QtyInStock ?? 0),
      low_stock_alert: Number(row.ReOrderLevel ?? 0),
      location: null,
    },
    images: [],
    created_at: null,
    updated_at: null,
  }));

  return {
    page: safePage,
    limit: safeLimit,
    total: count.recordset[0].total,
    products,
  };
}
