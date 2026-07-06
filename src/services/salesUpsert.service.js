/**
 * Sales service — writes to dbo.SalesInvoices, updates dbo.ProductsTable stock.
 * Auto-creates customer in dbo.Customers if new. Auto-sends email on success.
 */
import { sql, getPool } from "../config/db.js";
import { badRequest, notFound } from "../utils/httpErrors.js";
import { sendOrderEmail } from "./email.service.js";

export async function upsertSale(sale) {
  const pool = await getPool();
  const amount = (sale.sellprice ?? 0) * (sale.qty ?? 0);

  // 1. Auto-create customer if new
  if (sale.customerid) {
    const cust = await pool.request()
      .input("cid", sql.NVarChar(20), sale.customerid)
      .query("SELECT CustomerID FROM dbo.Customers WHERE CustomerID = @cid");
    if (cust.recordset.length === 0) {
      await pool.request()
        .input("cid", sql.NVarChar(20), sale.customerid)
        .input("name", sql.NVarChar(100), sale.customername || sale.customerid)
        .input("phone", sql.NVarChar(30), sale.customerphone || null)
        .input("email", sql.NVarChar(30), sale.customeremail || null)
        .input("addr", sql.NVarChar(75), sale.customeraddress || null)
        .query(`INSERT INTO dbo.Customers (CustomerID, CustomerName, PhoneNo1, Email, AddressLine1) VALUES (@cid, @name, @phone, @email, @addr)`);
    }
  }

  // 2. Check product exists and has enough stock
  const prod = await pool.request()
    .input("pid", sql.NVarChar(20), sale.productid)
    .query("SELECT ProductID, ProductName, QtyInStock FROM dbo.ProductsTable WHERE ProductID = @pid");

  if (prod.recordset.length === 0) {
    throw notFound(`Product "${sale.productid}" does not exist.`, "product_not_found");
  }

  const currentStock = Number(prod.recordset[0].QtyInStock ?? 0);
  const saleQty = Number(sale.qty ?? 0);

  if (currentStock < saleQty) {
    throw badRequest(`Insufficient stock for "${sale.productid}". Available: ${currentStock}, requested: ${saleQty}.`, "insufficient_stock");
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
    .query(`INSERT INTO dbo.SalesInvoices (InvoiceNo, ProductID, CustomerID, InvoiceDate, InvoiceTime, CostPrice, SellPrice, Qty, Amount, Status) VALUES (@inv, @pid, @cid, @date, @time, @cp, @sp, @qty, @amt, 1)`);

  // 4. Deduct stock
  await pool.request()
    .input("pid", sql.NVarChar(20), sale.productid)
    .input("qty", sql.Float, saleQty)
    .query("UPDATE dbo.ProductsTable SET QtyInStock = QtyInStock - @qty WHERE ProductID = @pid");

  const newStock = currentStock - saleQty;

  // 5. Send email notification
  let emailSent = false;
  try {
    await sendOrderEmail({
      type: "sales",
      invoiceno: sale.invoicenumber,
      invoicedate: sale.invoicedate || new Date().toISOString().slice(0, 10),
      productid: sale.productid,
      productname: prod.recordset[0].ProductName || sale.productid,
      qty: saleQty,
      costprice: sale.costprice,
      sellprice: sale.sellprice,
      amount,
      customerid: sale.customerid,
    });
    emailSent = true;
  } catch (e) {
    console.error("[sales] Email failed:", e.message);
  }

  return {
    operation: "created",
    invoice: { invoicenumber: sale.invoicenumber, productid: sale.productid, customerid: sale.customerid, qty: saleQty, costprice: sale.costprice, sellprice: sale.sellprice, amount },
    stock: { productid: sale.productid, qtyInStock: newStock, change: `-${saleQty}` },
    email_sent: emailSent,
  };
}
