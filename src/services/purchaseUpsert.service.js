/**
 * Purchase Invoice + Auto Stock Update.
 *
 * Flow:
 * 1. Auto-create supplier in dbo.Suppliers if SupplierID is new
 * 2. INSERT into dbo.PurchaseInvoices
 * 3. UPDATE dbo.ProductsTable: QtyInStock += qty (auto-create product if new)
 */
import { sql, getPool } from "../config/db.js";

export async function upsertPurchase(purchase) {
  const pool = await getPool();
  const amount = (purchase.costprice ?? 0) * (purchase.qty ?? 0);

  // 1. Ensure supplier exists
  if (purchase.supplierid) {
    const sup = await pool.request()
      .input("sid", sql.NVarChar(20), purchase.supplierid)
      .query("SELECT SupplierID FROM dbo.Suppliers WHERE SupplierID = @sid");
    if (sup.recordset.length === 0) {
      await pool.request()
        .input("sid", sql.NVarChar(20), purchase.supplierid)
        .input("name", sql.NVarChar(60), purchase.suppliername || purchase.supplierid)
        .query("INSERT INTO dbo.Suppliers (SupplierID, SupplierName) VALUES (@sid, @name)");
    }
  }

  // 2. Insert purchase invoice
  await pool.request()
    .input("inv", sql.NVarChar(20), purchase.invoiceno)
    .input("pid", sql.NVarChar(20), purchase.productid)
    .input("sid", sql.NVarChar(20), purchase.supplierid || null)
    .input("date", sql.DateTime, new Date(purchase.invoicedate || Date.now()))
    .input("time", sql.DateTime, new Date())
    .input("cp", sql.Float, purchase.costprice ?? 0)
    .input("sp", sql.Float, purchase.sellprice ?? 0)
    .input("qty", sql.Float, purchase.qty ?? 0)
    .input("amt", sql.Float, amount)
    .query(`
      INSERT INTO dbo.PurchaseInvoices
        (InvoiceNo, ProductID, SupplierID, InvoiceDate, InvoiceTime,
         CostPrice, SellPrice, Qty, Amount, Status)
      VALUES (@inv, @pid, @sid, @date, @time, @cp, @sp, @qty, @amt, 1)
    `);

  // 3. Update stock in ProductsTable
  const prod = await pool.request()
    .input("pid", sql.NVarChar(20), purchase.productid)
    .query("SELECT ProductID, QtyInStock FROM dbo.ProductsTable WHERE ProductID = @pid");

  if (prod.recordset.length === 0) {
    // Product doesn't exist — auto-create it with the purchase data
    await pool.request()
      .input("pid", sql.NVarChar(20), purchase.productid)
      .input("name", sql.NVarChar(275), purchase.productname || purchase.productid)
      .input("sp", sql.Float, purchase.sellprice ?? 0)
      .input("qty", sql.Float, purchase.qty ?? 0)
      .query(`
        INSERT INTO dbo.ProductsTable (ProductID, ProductName, SellPrice, QtyInStock, Satus)
        VALUES (@pid, @name, @sp, @qty, 1)
      `);
  } else {
    // Add to existing stock
    await pool.request()
      .input("pid", sql.NVarChar(20), purchase.productid)
      .input("qty", sql.Float, purchase.qty ?? 0)
      .query("UPDATE dbo.ProductsTable SET QtyInStock = QtyInStock + @qty WHERE ProductID = @pid");
  }

  // Get updated stock
  const updated = await pool.request()
    .input("pid", sql.NVarChar(20), purchase.productid)
    .query("SELECT QtyInStock FROM dbo.ProductsTable WHERE ProductID = @pid");

  return {
    operation: "created",
    invoice: {
      invoiceno: purchase.invoiceno,
      productid: purchase.productid,
      supplierid: purchase.supplierid,
      qty: purchase.qty,
      costprice: purchase.costprice,
      sellprice: purchase.sellprice,
      amount,
    },
    stock: {
      productid: purchase.productid,
      qtyInStock: Number(updated.recordset[0]?.QtyInStock ?? 0),
      change: `+${purchase.qty}`,
    },
  };
}
