import { Router } from "express";
import { listProducts } from "../services/productRead.service.js";

const router = Router();

// GET /rest/V1/integrations/shopmaster/products
// List all products with pagination and search
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

export default router;
