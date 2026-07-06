/**
 * Sales Invoice Upsert — writes to existing dbo.SalesInvoices.
 *
 * Called when a customer makes a purchase.
 *
 * Fields used (per dad's spec):
 *   customerid, invoicenumber, invoicedate, productid, costprice, sellprice, qty
 */
import { sql, getPool } from "../config/db.js";
import { conflict, badRequest } from "../utils/httpErrors.js";

function request(txn) {
  return new sql.Request(txn);
}

export async function upsertSalesInvoice(invoice) {
  const pool = await getPool();
  const txn = pool.transaction();

  try {
    await txn.begin();

    // Calculate amount = sellprice * qty (sales use sellprice for total)
    const amount = (invoice.sellprice ?? 0) * (invoice.qty ?? 0);

    // Check if this invoice+product combo already exists
    const existing = await request(txn)
      .input("inv", sql.VarChar(20), invoice.invoicenumber)
      .input("pid", sql.VarChar(20), invoice.productid)
      .query(`
        SELECT AutoID FROM dbo.SalesInvoices
        WHERE InvoiceNo = @inv AND ProductID = @pid
      `);

    const exists = existing.recordset.length > 0;
    const operation = exists ? "updated" : "created";

    if (exists) {
      await request(txn)
        .input("inv", sql.VarChar(20), invoice.invoicenumber)
        .input("pid", sql.VarChar(20), invoice.productid)
        .input("cid", sql.VarChar(20), invoice.customerid ?? null)
        .input("date", sql.DateTime, invoice.invoicedate ?? new Date())
        .input("cp", sql.Numeric(18, 2), invoice.costprice ?? 0)
        .input("sp", sql.Numeric(18, 2), invoice.sellprice ?? 0)
        .input("qty", sql.Numeric(18, 2), invoice.qty ?? 0)
        .input("amt", sql.Numeric(18, 2), amount)
        .query(`
          UPDATE dbo.SalesInvoices SET
            CustomerID  = @cid,
            InvoiceDate = @date,
            CostPrice   = @cp,
            SellPrice   = @sp,
            Qty         = @qty,
            Amount      = @amt
          WHERE InvoiceNo = @inv AND ProductID = @pid
        `);
    } else {
      await request(txn)
        .input("inv", sql.VarChar(20), invoice.invoicenumber)
        .input("pid", sql.VarChar(20), invoice.productid)
        .input("cid", sql.VarChar(20), invoice.customerid ?? null)
        .input("date", sql.DateTime, invoice.invoicedate ?? new Date())
        .input("time", sql.DateTime, new Date())
        .input("cp", sql.Numeric(18, 2), invoice.costprice ?? 0)
        .input("sp", sql.Numeric(18, 2), invoice.sellprice ?? 0)
        .input("qty", sql.Numeric(18, 2), invoice.qty ?? 0)
        .input("amt", sql.Numeric(18, 2), amount)
        .query(`
          INSERT INTO dbo.SalesInvoices
            (InvoiceNo, ProductID, CustomerID, InvoiceDate, InvoiceTime,
             CostPrice, SellPrice, Qty, Amount, Status)
          VALUES
            (@inv, @pid, @cid, @date, @time, @cp, @sp, @qty, @amt, 1)
        `);
    }

    await txn.commit();

    return {
      operation,
      invoice: {
        invoicenumber: invoice.invoicenumber,
        productid: invoice.productid,
        customerid: invoice.customerid,
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
