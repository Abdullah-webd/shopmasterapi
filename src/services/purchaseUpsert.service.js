/**
 * Purchase service — writes to dbo.PurchaseInvoices, updates dbo.ProductsTable stock.
 * Requires supplier to already exist in dbo.Suppliers.
 */
import { sql, getPool } from "../config/db.js";
import { notFound } from "../utils/httpErrors.js";

export async function upsertPurchase(purchase) {
  const pool = await getPool();
  const amount = (purchase.costprice ?? 0) * (purchase.qty ?? 0);

  // 1. Check supplier exists
  if (purchase.supplierid) {
    const sup = await pool.request()
      .input("sid", sql.NVarChar(20), purchase.supplierid)
      .query("SELECT SupplierID FROM dbo.Suppliers WHERE SupplierID = @sid");
    if (sup.recordset.length === 0) {
      throw notFound(`Supplier "${purchase.supplierid}" does not exist. Add supplier first.`, "supplier_not_found");
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
        (InvoiceNo, ProductID, SupplierID, InvoiceDate, InvoiceTime, CostPrice, SellPrice, Qty, Amount, Status)
      VALUES (@inv, @pid, @sid, @date, @time, @cp, @sp, @qty, @amt, 1)
    `);

  // 3. Update stock — auto-create product if new
  const prod = await pool.request()
    .input("pid", sql.NVarChar(20), purchase.productid)
    .query("SELECT ProductID, QtyInStock FROM dbo.ProductsTable WHERE ProductID = @pid");

  if (prod.recordset.length === 0) {
    await pool.request()
      .input("pid", sql.NVarChar(20), purchase.productid)
      .input("name", sql.NVarChar(275), purchase.productname || purchase.productid)
      .input("sp", sql.Float, purchase.sellprice ?? 0)
      .input("qty", sql.Float, purchase.qty ?? 0)
      .query(`INSERT INTO dbo.ProductsTable (ProductID, ProductName, SellPrice, QtyInStock, Satus) VALUES (@pid, @name, @sp, @qty, 1)`);
  } else {
    await pool.request()
      .input("pid", sql.NVarChar(20), purchase.productid)
      .input("qty", sql.Float, purchase.qty ?? 0)
      .query("UPDATE dbo.ProductsTable SET QtyInStock = QtyInStock + @qty WHERE ProductID = @pid");
  }

  const updated = await pool.request()
    .input("pid", sql.NVarChar(20), purchase.productid)
    .query("SELECT QtyInStock FROM dbo.ProductsTable WHERE ProductID = @pid");

  return {
    operation: "created",
    invoice: { invoiceno: purchase.invoiceno, productid: purchase.productid, supplierid: purchase.supplierid, qty: purchase.qty, costprice: purchase.costprice, sellprice: purchase.sellprice, amount },
    stock: { productid: purchase.productid, qtyInStock: Number(updated.recordset[0]?.QtyInStock ?? 0), change: `+${purchase.qty}` },
  };
}
