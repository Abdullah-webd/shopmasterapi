/**
 * Shopmaster Product Upsert — writes to EXISTING ProductsTable in SBasic000.
 *
 * Mapping:
 *   Shopmaster JSON          →  ProductsTable column
 *   ─────────────────────────────────────────────────
 *   external_product_id      →  ProductID      (varchar(20), NOT NULL)
 *   name                     →  ProductName    (varchar(275))
 *   price                    →  SellPrice      (numeric)
 *   inventory.stock_qty      →  QtyInStock     (numeric)
 *   inventory.low_stock_alert→  ReOrderLevel   (numeric)
 *   sku                      →  POSName        (varchar(20))
 *   status                   →  stored as Satus (int) — 1=active, 0=other
 *
 * Fields NOT in ProductsTable (dropped silently):
 *   description, ingredients, how_to_use, weight,
 *   brand, categories, skin_types, tags, images
 *
 * PurchaseInvoices & SalesInvoices are NOT touched by this API.
 * They are populated by the existing POS system during buying/selling.
 */
import { sql, getPool } from "../config/db.js";
import { conflict, badRequest } from "../utils/httpErrors.js";

// ── helpers ──────────────────────────────────────────────────────────
function request(txn) {
  return new sql.Request(txn);
}

function statusToInt(status) {
  switch (status) {
    case "active": return 1;
    case "inactive": return 0;
    case "draft": return 0;
    case "archived": return 0;
    default: return 0;
  }
}

// ── main ─────────────────────────────────────────────────────────────
export async function upsertProduct(product) {
  const pool = await getPool();
  const txn = pool.transaction();

  try {
    await txn.begin();

    // Check if product already exists by ProductID
    const existing = await request(txn)
      .input("pid", sql.VarChar(20), product.external_product_id)
      .query(`SELECT ProductID FROM dbo.ProductsTable WHERE ProductID = @pid`);

    const exists = existing.recordset.length > 0;
    const operation = exists ? "updated" : "created";

    if (exists) {
      await request(txn)
        .input("pid", sql.VarChar(20), product.external_product_id)
        .input("name", sql.VarChar(275), product.name ?? null)
        .input("sp", sql.Numeric(18, 2), product.price ?? 0)
        .input("qty", sql.Numeric(18, 2), product.inventory?.stock_qty ?? 0)
        .input("reorder", sql.Numeric(18, 2), product.inventory?.low_stock_alert ?? 0)
        .input("posname", sql.VarChar(20), (product.sku ?? "").slice(0, 20))
        .input("satus", sql.Int, statusToInt(product.status))
        .query(`
          UPDATE dbo.ProductsTable SET
            ProductName = @name,
            SellPrice   = @sp,
            QtyInStock  = @qty,
            ReOrderLevel = @reorder,
            POSName     = @posname,
            Satus       = @satus
          WHERE ProductID = @pid
        `);
    } else {
      await request(txn)
        .input("pid", sql.VarChar(20), product.external_product_id)
        .input("name", sql.VarChar(275), product.name ?? null)
        .input("sp", sql.Numeric(18, 2), product.price ?? 0)
        .input("qty", sql.Numeric(18, 2), product.inventory?.stock_qty ?? 0)
        .input("reorder", sql.Numeric(18, 2), product.inventory?.low_stock_alert ?? 0)
        .input("posname", sql.VarChar(20), (product.sku ?? "").slice(0, 20))
        .input("satus", sql.Int, statusToInt(product.status))
        .query(`
          INSERT INTO dbo.ProductsTable
            (ProductID, ProductName, SellPrice, QtyInStock, ReOrderLevel, POSName, Satus)
          VALUES
            (@pid, @name, @sp, @qty, @reorder, @posname, @satus)
        `);
    }

    await txn.commit();

    return {
      operation,
      product: {
        product_id: product.external_product_id,
        name: product.name,
        price: product.price,
        stock: product.inventory?.stock_qty ?? 0,
        updated_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      },
    };
  } catch (err) {
    await safeRollback(txn);
    throw translateDbError(err, product);
  }
}

// ── error translation ────────────────────────────────────────────────
function translateDbError(err, product) {
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("primary key") || msg.includes("unique") || msg.includes("duplicate")) {
    return conflict(
      `Product ID "${product.external_product_id}" already exists. Use update instead.`,
      "duplicate_product"
    );
  }
  if (msg.includes("truncat") || msg.includes("would be truncated")) {
    return badRequest("A field value is too long for the database column.", "value_too_long");
  }
  return err;
}

async function safeRollback(txn) {
  try { await txn.rollback(); } catch { /* already rolled back */ }
}
