/**
 * Purchase Invoice — writes to existing dbo.PurchaseInvoices.
 * Called when the company buys new stock from a supplier.
 */
import { sql, getPool } from "../config/db.js";

export async function upsertPurchaseInvoice(invoice) {
  const pool = await getPool();
  const amount = (invoice.costprice ?? 0) * (invoice.qty ?? 0);

  // Check if invoice+product already exists
  const existing = await pool
    .request()
    .input("inv", sql.NVarChar(20), invoice.invoiceno)
    .input("pid", sql.NVarChar(20), invoice.productid)
    .query(`SELECT AutoID FROM dbo.PurchaseInvoices WHERE InvoiceNo = @inv AND ProductID = @pid`);

  const exists = existing.recordset.length > 0;
  const operation = exists ? "updated" : "created";

  if (exists) {
    await pool
      .request()
      .input("inv", sql.NVarChar(20), invoice.invoiceno)
      .input("pid", sql.NVarChar(20), invoice.productid)
      .input("sid", sql.NVarChar(20), invoice.supplierid ?? null)
      .input("date", sql.DateTime, new Date(invoice.invoicedate || Date.now()))
      .input("cp", sql.Float, invoice.costprice ?? 0)
      .input("sp", sql.Float, invoice.sellprice ?? 0)
      .input("qty", sql.Float, invoice.qty ?? 0)
      .input("amt", sql.Float, amount)
      .query(`
        UPDATE dbo.PurchaseInvoices SET
          SupplierID = @sid, InvoiceDate = @date,
          CostPrice = @cp, SellPrice = @sp, Qty = @qty, Amount = @amt
        WHERE InvoiceNo = @inv AND ProductID = @pid
      `);
  } else {
    await pool
      .request()
      .input("inv", sql.NVarChar(20), invoice.invoiceno)
      .input("pid", sql.NVarChar(20), invoice.productid)
      .input("sid", sql.NVarChar(20), invoice.supplierid ?? null)
      .input("date", sql.DateTime, new Date(invoice.invoicedate || Date.now()))
      .input("time", sql.DateTime, new Date())
      .input("cp", sql.Float, invoice.costprice ?? 0)
      .input("sp", sql.Float, invoice.sellprice ?? 0)
      .input("qty", sql.Float, invoice.qty ?? 0)
      .input("amt", sql.Float, amount)
      .query(`
        INSERT INTO dbo.PurchaseInvoices
          (InvoiceNo, ProductID, SupplierID, InvoiceDate, InvoiceTime,
           CostPrice, SellPrice, Qty, Amount, Status)
        VALUES (@inv, @pid, @sid, @date, @time, @cp, @sp, @qty, @amt, 1)
      `);
  }

  return {
    operation,
    invoice: {
      invoiceno: invoice.invoiceno,
      productid: invoice.productid,
      supplierid: invoice.supplierid,
      qty: invoice.qty,
      costprice: invoice.costprice,
      sellprice: invoice.sellprice,
      amount,
    },
  };
}
