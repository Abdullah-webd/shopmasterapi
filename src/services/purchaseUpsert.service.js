/**
 * Purchase Invoice Upsert — writes to existing dbo.PurchaseInvoices.
 *
 * Called when the company buys new stock from a supplier.
 *
 * Fields used (per dad's spec):
 *   supplierid, invoiceno, invoicedate, productid, costprice, sellprice, qty
 */
import { sql, getPool } from "../config/db.js";
import { conflict, badRequest } from "../utils/httpErrors.js";

function request(txn) {
  return new sql.Request(txn);
}

export async function upsertPurchaseInvoice(invoice) {
  const pool = await getPool();
  const txn = pool.transaction();

  try {
    await txn.begin();

    // Calculate amount = costprice * qty
    const amount = (invoice.costprice ?? 0) * (invoice.qty ?? 0);

    // Check if this invoice+product combo already exists
    const existing = await request(txn)
      .input("inv", sql.VarChar(20), invoice.invoiceno)
      .input("pid", sql.VarChar(20), invoice.productid)
      .query(`
        SELECT AutoID FROM dbo.PurchaseInvoices
        WHERE InvoiceNo = @inv AND ProductID = @pid
      `);

    const exists = existing.recordset.length > 0;
    const operation = exists ? "updated" : "created";

    if (exists) {
      await request(txn)
        .input("inv", sql.VarChar(20), invoice.invoiceno)
        .input("pid", sql.VarChar(20), invoice.productid)
        .input("sid", sql.VarChar(20), invoice.supplierid ?? null)
        .input("date", sql.DateTime, invoice.invoicedate ?? new Date())
        .input("cp", sql.Numeric(18, 2), invoice.costprice ?? 0)
        .input("sp", sql.Numeric(18, 2), invoice.sellprice ?? 0)
        .input("qty", sql.Numeric(18, 2), invoice.qty ?? 0)
        .input("amt", sql.Numeric(18, 2), amount)
        .query(`
          UPDATE dbo.PurchaseInvoices SET
            SupplierID  = @sid,
            InvoiceDate = @date,
            CostPrice   = @cp,
            SellPrice   = @sp,
            Qty         = @qty,
            Amount      = @amt
          WHERE InvoiceNo = @inv AND ProductID = @pid
        `);
    } else {
      await request(txn)
        .input("inv", sql.VarChar(20), invoice.invoiceno)
        .input("pid", sql.VarChar(20), invoice.productid)
        .input("sid", sql.VarChar(20), invoice.supplierid ?? null)
        .input("date", sql.DateTime, invoice.invoicedate ?? new Date())
        .input("time", sql.DateTime, new Date())
        .input("cp", sql.Numeric(18, 2), invoice.costprice ?? 0)
        .input("sp", sql.Numeric(18, 2), invoice.sellprice ?? 0)
        .input("qty", sql.Numeric(18, 2), invoice.qty ?? 0)
        .input("amt", sql.Numeric(18, 2), amount)
        .query(`
          INSERT INTO dbo.PurchaseInvoices
            (InvoiceNo, ProductID, SupplierID, InvoiceDate, InvoiceTime,
             CostPrice, SellPrice, Qty, Amount, Status)
          VALUES
            (@inv, @pid, @sid, @date, @time, @cp, @sp, @qty, @amt, 1)
        `);
    }

    await txn.commit();

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
  } catch (err) {
    await safeRollback(txn);
    throw err;
  }
}

async function safeRollback(txn) {
  try { await txn.rollback(); } catch { /* already rolled back */ }
}
