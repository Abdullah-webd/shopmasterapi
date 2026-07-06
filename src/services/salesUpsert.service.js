/**
 * Sales Invoice — writes to existing dbo.SalesInvoices.
 * Called when a customer makes a purchase.
 */
import { sql, getPool } from "../config/db.js";

export async function upsertSalesInvoice(invoice) {
  const pool = await getPool();
  const amount = (invoice.sellprice ?? 0) * (invoice.qty ?? 0);

  // Check if invoice+product already exists
  const existing = await pool
    .request()
    .input("inv", sql.NVarChar(20), invoice.invoicenumber)
    .input("pid", sql.NVarChar(20), invoice.productid)
    .query(`SELECT AutoID FROM dbo.SalesInvoices WHERE InvoiceNo = @inv AND ProductID = @pid`);

  const exists = existing.recordset.length > 0;
  const operation = exists ? "updated" : "created";

  if (exists) {
    await pool
      .request()
      .input("inv", sql.NVarChar(20), invoice.invoicenumber)
      .input("pid", sql.NVarChar(20), invoice.productid)
      .input("cid", sql.NVarChar(20), invoice.customerid ?? null)
      .input("date", sql.DateTime, new Date(invoice.invoicedate || Date.now()))
      .input("cp", sql.Float, invoice.costprice ?? 0)
      .input("sp", sql.Float, invoice.sellprice ?? 0)
      .input("qty", sql.Float, invoice.qty ?? 0)
      .input("amt", sql.Float, amount)
      .query(`
        UPDATE dbo.SalesInvoices SET
          CustomerID = @cid, InvoiceDate = @date,
          CostPrice = @cp, SellPrice = @sp, Qty = @qty, Amount = @amt
        WHERE InvoiceNo = @inv AND ProductID = @pid
      `);
  } else {
    await pool
      .request()
      .input("inv", sql.NVarChar(20), invoice.invoicenumber)
      .input("pid", sql.NVarChar(20), invoice.productid)
      .input("cid", sql.NVarChar(20), invoice.customerid ?? null)
      .input("date", sql.DateTime, new Date(invoice.invoicedate || Date.now()))
      .input("time", sql.DateTime, new Date())
      .input("cp", sql.Float, invoice.costprice ?? 0)
      .input("sp", sql.Float, invoice.sellprice ?? 0)
      .input("qty", sql.Float, invoice.qty ?? 0)
      .input("amt", sql.Float, amount)
      .query(`
        INSERT INTO dbo.SalesInvoices
          (InvoiceNo, ProductID, CustomerID, InvoiceDate, InvoiceTime,
           CostPrice, SellPrice, Qty, Amount, Status)
        VALUES (@inv, @pid, @cid, @date, @time, @cp, @sp, @qty, @amt, 1)
      `);
  }

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
}
