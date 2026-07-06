import { Router } from "express";
import {
  singleUpsertSchema,
  bulkUpsertSchema,
  formatZodError,
  BULK_HARD_MAX,
} from "../schemas/product.schema.js";
import { upsertProduct } from "../services/productUpsert.service.js";
import { listProducts } from "../services/productRead.service.js";
import { badRequest } from "../utils/httpErrors.js";

const router = Router();

// ===========================================================================
// GET /rest/V1/integrations/shopmaster/products
// Fetch products currently stored in the database.
// ===========================================================================
router.get("/", async (req, res, next) => {
  try {
    const result = await listProducts({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// POST /rest/V1/integrations/shopmaster/products/upsert
// Single product create-or-update.
// ===========================================================================
router.post("/upsert", async (req, res, next) => {
  try {
    const parsed = singleUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = formatZodError(parsed.error);
      return res.status(400).json(body);
    }

    const result = await upsertProduct(parsed.data);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// POST /rest/V1/integrations/shopmaster/products/bulk-upsert
// Up to 15 products per request. Each product is processed independently:
// one bad product won't fail the whole batch.
// ===========================================================================
router.post("/bulk-upsert", async (req, res, next) => {
  try {
    // Hard-cap check first (zod also catches it, but this gives a clean 400
    // without running the full per-item validation on a huge payload).
    if (Array.isArray(req.body?.products) && req.body.products.length > BULK_HARD_MAX) {
      throw badRequest(
        `bulk-upsert allows a maximum of ${BULK_HARD_MAX} products per request.`,
        "bulk_limit_exceeded"
      );
    }

    const parsed = bulkUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = formatZodError(parsed.error);
      return res.status(400).json(body);
    }

    const { batch_id, products } = parsed.data;

    let created = 0;
    let updated = 0;
    let failed = 0;
    const items = [];

    for (const product of products) {
      try {
        const result = await upsertProduct(product);
        if (result.operation === "created") created++;
        else updated++;
        items.push({
          external_product_id: product.external_product_id,
          sku: product.sku,
          operation: result.operation,
          success: true,
          product_id: result.product.product_id,
        });
      } catch (err) {
        failed++;
        items.push({
          external_product_id: product.external_product_id,
          sku: product.sku,
          success: false,
          status: err.status || 500,
          message: err.message,
          code: err.code || "item_failed",
        });
      }
    }

    return res.status(200).json({
      success: failed === 0,
      batch_id,
      total: products.length,
      created,
      updated,
      failed,
      items,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
