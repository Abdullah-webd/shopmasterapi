import { Router } from "express";
import { upsertPurchase } from "../services/purchaseUpsert.service.js";
import { upsertSale } from "../services/salesUpsert.service.js";
import { badRequest } from "../utils/httpErrors.js";

const router = Router();

// ── Single Purchase ─────────────────────────────────────────────────
router.post("/purchase/upsert", async (req, res, next) => {
  try {
    const { supplierid, suppliername, invoiceno, invoicedate, productid, productname, costprice, sellprice, qty } = req.body;
    if (!invoiceno || !productid) throw badRequest("invoiceno and productid required.", "missing_fields");
    const r = await upsertPurchase({ supplierid, suppliername, invoiceno, invoicedate, productid, productname, costprice, sellprice, qty });
    res.json({ success: true, ...r });
  } catch (e) { next(e); }
});

// ── Bulk Purchase ───────────────────────────────────────────────────
router.post("/purchase/bulk-upsert", async (req, res, next) => {
  try {
    const { batch_id, purchases } = req.body;
    if (!Array.isArray(purchases) || purchases.length === 0) throw badRequest("purchases array required.", "missing_fields");
    if (purchases.length > 15) throw badRequest("Max 15 purchases per batch.", "bulk_limit");

    let created = 0, failed = 0;
    const items = [];
    for (const p of purchases) {
      try {
        if (!p.invoiceno || !p.productid) throw new Error("invoiceno and productid required");
        const r = await upsertPurchase(p);
        created++;
        items.push({ invoiceno: p.invoiceno, productid: p.productid, success: true, ...r });
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
    const { customerid, customername, invoicenumber, invoicedate, productid, costprice, sellprice, qty } = req.body;
    if (!invoicenumber || !productid) throw badRequest("invoicenumber and productid required.", "missing_fields");
    const r = await upsertSale({ customerid, customername, invoicenumber, invoicedate, productid, costprice, sellprice, qty });
    res.json({ success: true, ...r });
  } catch (e) { next(e); }
});

// ── Bulk Sale ───────────────────────────────────────────────────────
router.post("/sales/bulk-upsert", async (req, res, next) => {
  try {
    const { batch_id, sales } = req.body;
    if (!Array.isArray(sales) || sales.length === 0) throw badRequest("sales array required.", "missing_fields");
    if (sales.length > 15) throw badRequest("Max 15 sales per batch.", "bulk_limit");

    let created = 0, failed = 0;
    const items = [];
    for (const s of sales) {
      try {
        if (!s.invoicenumber || !s.productid) throw new Error("invoicenumber and productid required");
        const r = await upsertSale(s);
        created++;
        items.push({ invoicenumber: s.invoicenumber, productid: s.productid, success: true, ...r });
      } catch (err) {
        failed++;
        items.push({ invoicenumber: s.invoicenumber, productid: s.productid, success: false, message: err.message });
      }
    }
    res.json({ success: failed === 0, batch_id, total: sales.length, created, failed, items });
  } catch (e) { next(e); }
});

export default router;
