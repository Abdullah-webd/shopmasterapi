import { Router } from "express";
import { upsertSupplier } from "../services/supplier.service.js";
import { upsertPurchase } from "../services/purchaseUpsert.service.js";
import { upsertSale } from "../services/salesUpsert.service.js";
import { badRequest } from "../utils/httpErrors.js";

const router = Router();

// ── Supplier ────────────────────────────────────────────────────────
router.post("/supplier/upsert", async (req, res, next) => {
  try {
    const { supplierid, suppliername, phone, email, address, city, state } = req.body;
    if (!supplierid || !suppliername) throw badRequest("supplierid and suppliername required.", "missing_fields");
    const r = await upsertSupplier({ supplierid, suppliername, phone, email, address, city, state });
    res.json({ success: true, ...r });
  } catch (e) { next(e); }
});

// ── Single Purchase ─────────────────────────────────────────────────
router.post("/purchase/upsert", async (req, res, next) => {
  try {
    const { supplierid, invoiceno, invoicedate, productid, productname, costprice, sellprice, qty } = req.body;
    if (!invoiceno || !productid) throw badRequest("invoiceno and productid required.", "missing_fields");
    const r = await upsertPurchase({ supplierid, invoiceno, invoicedate, productid, productname, costprice, sellprice, qty });
    res.json({ success: true, ...r });
  } catch (e) { next(e); }
});

// ── Bulk Purchase ───────────────────────────────────────────────────
router.post("/purchase/bulk-upsert", async (req, res, next) => {
  try {
    const { batch_id, purchases } = req.body;
    if (!Array.isArray(purchases) || purchases.length === 0) throw badRequest("purchases array required.", "missing_fields");
    if (purchases.length > 15) throw badRequest("Max 15 purchases.", "bulk_limit");

    let created = 0, failed = 0;
    const items = [];
    for (const p of purchases) {
      try {
        if (!p.invoiceno || !p.productid) throw new Error("invoiceno and productid required");
        items.push({ invoiceno: p.invoiceno, productid: p.productid, success: true, ...(await upsertPurchase(p)) });
        created++;
      } catch (err) {
        failed++;
        items.push({ invoiceno: p.invoiceno, productid: p.productid, success: false, message: err.message });
      }
    }
    res.json({ success: failed === 0, batch_id, total: purchases.length, created, failed, items });
  } catch (e) { next(e); }
});

// ── Single Sale ─────────────────────────────────────────────────────
router.post("/sales/upsert", async (req, res, next) => {
  try {
    const { customerid, customername, customerphone, customeremail, customeraddress, invoicenumber, invoicedate, productid, costprice, sellprice, qty } = req.body;
    if (!invoicenumber || !productid) throw badRequest("invoicenumber and productid required.", "missing_fields");
    const r = await upsertSale({ customerid, customername, customerphone, customeremail, customeraddress, invoicenumber, invoicedate, productid, costprice, sellprice, qty });
    res.json({ success: true, ...r });
  } catch (e) { next(e); }
});

// ── Bulk Sale ───────────────────────────────────────────────────────
router.post("/sales/bulk-upsert", async (req, res, next) => {
  try {
    const { batch_id, sales } = req.body;
    if (!Array.isArray(sales) || sales.length === 0) throw badRequest("sales array required.", "missing_fields");
    if (sales.length > 15) throw badRequest("Max 15 sales.", "bulk_limit");

    let created = 0, failed = 0;
    const items = [];
    for (const s of sales) {
      try {
        if (!s.invoicenumber || !s.productid) throw new Error("invoicenumber and productid required");
        items.push({ invoicenumber: s.invoicenumber, productid: s.productid, success: true, ...(await upsertSale(s)) });
        created++;
      } catch (err) {
        failed++;
        items.push({ invoicenumber: s.invoicenumber, productid: s.productid, success: false, message: err.message });
      }
    }
    res.json({ success: failed === 0, batch_id, total: sales.length, created, failed, items });
  } catch (e) { next(e); }
});

export default router;
