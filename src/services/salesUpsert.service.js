/**
 * Sales Invoice + Auto Stock Deduction.
 *
 * Flow:
 * 1. Auto-create customer in dbo.Customers if CustomerID is new
 * 2. Validate product exists AND has enough stock
 * 3. INSERT into dbo.SalesInvoices
 * 4. UPDATE dbo.ProductsTable: QtyInStock -= qty
 */
import { sql, getPool } from "../config/db.js";
import { badRequest, notFound } from "../utils/httpErrors.js";

export async function upsertSale(sale) {
  const pool = await getPool();
  const amount = (sale.sellprice ?? 0) * (sale.qty ?? 0);

  // 1. Ensure customer exists
  if (sale.customerid) {
    const cust = await pool.request()
      .input("cid", sql.NVarChar(20), sale.customerid)
      .query("SELECT CustomerID FROM dbo.Customers WHERE CustomerID = @cid");
    if (cust.recordset.length === 0) {
      await pool.request()
        .input("cid", sql.NVarChar(20), sale.customerid)
        .input("name", sql.NVarChar(100), sale.customername || sale.customerid)
        .query("INSERT INTO dbo.Customers (CustomerID, CustomerName) VALUES (@cid, @name)");
    }
  }

  // 2. Check product exists and has enough stock
  const prod = await pool.request()
    .input("pid", sql.NVarChar(20), sale.productid)
    .query("SELECT ProductID, ProductName, QtyInStock FROM dbo.ProductsTable WHERE ProductID = @pid");

  if (prod.recordset.length === 0) {
    throw notFound(`Product "${sale.productid}" not found. Cannot sell a product that doesn't exist.`, "product_not_found");
  }

  const currentStock = Number(prod.recordset[0].QtyInStock ?? 0);
  const saleQty = Number(sale.qty ?? 0);

  if (currentStock < saleQty) {
    throw badRequest(
      `Insufficient stock for "${sale.productid}". Available: ${currentStock}, requested: ${saleQty}.`,
      "insufficient_stock"
    );
  }

  // 3. Insert sales invoice
  await pool.request()
    .input("inv", sql.NVarChar(20), sale.invoicenumber)
    .input("pid", sql.NVarChar(20), sale.productid)
    .input("cid", sql.NVarChar(20), sale.customerid || null)
    .input("date", sql.DateTime, new Date(sale.invoicedate || Date.now()))
    .input("time", sql.DateTime, new Date())
    .input("cp", sql.Float, sale.costprice ?? 0)
    .input("sp", sql.Float, sale.sellprice ?? 0)
    .input("qty", sql.Float, saleQty)
    .input("amt", sql.Float, amount)
    .query(`
      INSERT INTO dbo.SalesInvoices
        (InvoiceNo, ProductID, CustomerID, InvoiceDate, InvoiceTime,
         CostPrice, SellPrice, Qty, Amount, Status)
      VALUES (@inv, @pid, @cid, @date, @time, @cp, @sp, @qty, @amt, 1)
    `);

  // 4. Deduct stock
  await pool.request()
    .input("pid", sql.NVarChar(20), sale.productid)
    .input("qty", sql.Float, saleQty)
    .query("UPDATE dbo.ProductsTable SET QtyInStock = QtyInStock - @qty WHERE ProductID = @pid");

  const newStock = currentStock - saleQty;

  return {
    operation: "created",
    invoice: {
      invoicenumber: sale.invoicenumber,
      productid: sale.productid,
      customerid: sale.customerid,
      qty: saleQty,
      costprice: sale.costprice,
      sellprice: sale.sellprice,
      amount,
    },
    stock: {
      productid: sale.productid,
      qtyInStock: newStock,
      change: `-${saleQty}`,
    },
  };
}
