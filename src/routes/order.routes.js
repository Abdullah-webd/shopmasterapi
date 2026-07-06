import { Router } from "express";
import { sendOrderEmail } from "../services/email.service.js";
import { badRequest } from "../utils/httpErrors.js";

const router = Router();

// POST /rest/V1/integrations/shopmaster/order/notify
//
// Sends an email notification about an order (purchase or sale).
// Call this after creating a purchase or sales invoice.
//
// Example — Purchase:
// {
//   "type": "purchase",
//   "invoiceno": "PINV-2026-00042",
//   "invoicedate": "2026-07-06",
//   "productid": "SM-PROD-10001",
//   "productname": "Milk Facial Toner",
//   "qty": 50,
//   "costprice": 8000,
//   "sellprice": 18000,
//   "amount": 400000,
//   "supplierid": "SUP-001"
// }
//
// Example — Sale:
// {
//   "type": "sales",
//   "invoiceno": "SINV-2026-01023",
//   "invoicedate": "2026-07-06",
//   "productid": "SM-PROD-10001",
//   "productname": "Milk Facial Toner",
//   "qty": 2,
//   "costprice": 8000,
//   "sellprice": 18000,
//   "amount": 36000,
//   "customerid": "CUST-042"
// }
router.post("/order/notify", async (req, res, next) => {
  try {
    const { type, invoiceno, productid } = req.body;

    if (!type || !["purchase", "sales"].includes(type)) {
      throw badRequest("type must be 'purchase' or 'sales'.", "invalid_type");
    }
    if (!invoiceno || !productid) {
      throw badRequest("invoiceno and productid are required.", "missing_fields");
    }

    const result = await sendOrderEmail(req.body);

    return res.status(200).json({
      success: true,
      message: `Order email sent to webmastersmma@gmail.com`,
      email_id: result.emailId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
