import { Router } from "express";
import { upsertPurchaseInvoice } from "../services/purchaseUpsert.service.js";
import { upsertSalesInvoice } from "../services/salesUpsert.service.js";
import { badRequest } from "../utils/httpErrors.js";

const router = Router();

// ── Purchase Invoice ─────────────────────────────────────────────────
// POST /rest/V1/integrations/shopmaster/purchase/upsert
//
// Called when the company buys new stock from a supplier.
// Example request:
// {
//   "supplierid": "SUP-001",
//   "invoiceno": "PINV-2026-00042",
//   "invoicedate": "2026-07-06",
//   "productid": "SM-PROD-10001",
//   "costprice": 8000,
//   "sellprice": 18000,
//   "qty": 50
// }
router.post("/purchase/upsert", async (req, res, next) => {
  try {
    const { supplierid, invoiceno, invoicedate, productid, costprice, sellprice, qty } = req.body;

    // Required fields check
    if (!invoiceno || !productid) {
      throw badRequest("invoiceno and productid are required.", "missing_fields");
    }

    const result = await upsertPurchaseInvoice({
      supplierid,
      invoiceno,
      invoicedate: invoicedate ? new Date(invoicedate) : new Date(),
      productid,
      costprice: Number(costprice) || 0,
      sellprice: Number(sellprice) || 0,
      qty: Number(qty) || 0,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ── Sales Invoice ────────────────────────────────────────────────────
// POST /rest/V1/integrations/shopmaster/sales/upsert
//
// Called when a customer makes a purchase.
// Example request:
// {
//   "customerid": "CUST-042",
//   "invoicenumber": "SINV-2026-01023",
//   "invoicedate": "2026-07-06",
//   "productid": "SM-PROD-10001",
//   "costprice": 8000,
//   "sellprice": 18000,
//   "qty": 2
// }
router.post("/sales/upsert", async (req, res, next) => {
  try {
    const { customerid, invoicenumber, invoicedate, productid, costprice, sellprice, qty } = req.body;

    if (!invoicenumber || !productid) {
      throw badRequest("invoicenumber and productid are required.", "missing_fields");
    }

    const result = await upsertSalesInvoice({
      customerid,
      invoicenumber,
      invoicedate: invoicedate ? new Date(invoicedate) : new Date(),
      productid,
      costprice: Number(costprice) || 0,
      sellprice: Number(sellprice) || 0,
      qty: Number(qty) || 0,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
