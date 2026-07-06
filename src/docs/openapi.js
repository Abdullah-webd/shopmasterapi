export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Shopmaster Integration API",
    version: "3.0.0",
    description:
      "Product catalog, purchase/sales invoices linked to live stock, and order email notifications. All endpoints write to existing SBasic000 tables.\n\n![Workflow Diagram](/workflow.png)",
  },
  servers: [
    { url: "https://shopmasterapi.onrender.com", description: "Production (Render)" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  tags: [
    { name: "System" },
    { name: "Products", description: "Product listing" },
    { name: "Purchases", description: "Stock purchases from suppliers → auto-updates stock" },
    { name: "Sales", description: "Customer sales → auto-deducts stock" },
    { name: "Orders", description: "Email notifications" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "token" },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
          code: { type: "string" },
        },
      },
      PurchaseInput: {
        type: "object",
        required: ["invoiceno", "productid", "qty"],
        properties: {
          supplierid: { type: "string", example: "SUP-001" },
          suppliername: { type: "string", example: "ABC Suppliers Ltd" },
          invoiceno: { type: "string", example: "PINV-2026-00042" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06" },
          productid: { type: "string", example: "SM-PROD-10001" },
          productname: { type: "string", example: "Milk Facial Toner" },
          costprice: { type: "number", example: 8000 },
          sellprice: { type: "number", example: 18000 },
          qty: { type: "number", example: 50 },
        },
      },
      SaleInput: {
        type: "object",
        required: ["invoicenumber", "productid", "qty"],
        properties: {
          customerid: { type: "string", example: "CUST-042" },
          customername: { type: "string", example: "John Doe" },
          invoicenumber: { type: "string", example: "SINV-2026-01023" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06" },
          productid: { type: "string", example: "SM-PROD-10001" },
          costprice: { type: "number", example: 8000 },
          sellprice: { type: "number", example: 18000 },
          qty: { type: "number", example: 2 },
        },
      },
      OrderNotifyInput: {
        type: "object",
        required: ["type", "invoiceno", "productid", "qty", "amount"],
        properties: {
          type: { type: "string", enum: ["purchase", "sales"], example: "sales" },
          invoiceno: { type: "string", example: "SINV-2026-01023" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06" },
          productid: { type: "string", example: "SM-PROD-10001" },
          productname: { type: "string", example: "Milk Facial Toner" },
          qty: { type: "integer", example: 2 },
          costprice: { type: "integer", example: 8000 },
          sellprice: { type: "integer", example: 18000 },
          amount: { type: "integer", example: 36000 },
          supplierid: { type: "string", example: "SUP-001" },
          customerid: { type: "string", example: "CUST-042" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: { tags: ["System"], summary: "Health check", responses: { 200: { description: "ok" } } },
    },

    // ── Products ──
    "/rest/V1/integrations/shopmaster/products": {
      get: {
        tags: ["Products"],
        summary: "List all products",
        description: "Fetches products from dbo.ProductsTable with pagination and search. Stock quantity reflects live purchase/sales activity.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search ProductID, ProductName, or POSName" },
        ],
        responses: {
          200: { description: "Product list" },
          401: { description: "Unauthorized" },
        },
      },
    },

    // ── Purchase: Single ──
    "/rest/V1/integrations/shopmaster/purchase/upsert": {
      post: {
        tags: ["Purchases"],
        summary: "Record a stock purchase",
        description: "INSERTS into PurchaseInvoices, auto-creates supplier if new, and ADDS stock to ProductsTable (+qty). If product doesn't exist, it's auto-created.",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseInput" } } } },
        responses: {
          200: { description: "Purchase recorded + stock updated" },
          400: { description: "Missing fields" },
          401: { description: "Unauthorized" },
        },
      },
    },

    // ── Purchase: Bulk ──
    "/rest/V1/integrations/shopmaster/purchase/bulk-upsert": {
      post: {
        tags: ["Purchases"],
        summary: "Bulk stock purchases (max 15)",
        description: "Same as single purchase but for multiple items. Each item processed independently.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["purchases"],
                properties: {
                  batch_id: { type: "string", example: "batch-001" },
                  purchases: { type: "array", maxItems: 15, items: { $ref: "#/components/schemas/PurchaseInput" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Bulk result with per-item status" },
          400: { description: "Validation error or >15 items" },
        },
      },
    },

    // ── Sale: Single ──
    "/rest/V1/integrations/shopmaster/sales/upsert": {
      post: {
        tags: ["Sales"],
        summary: "Record a customer sale",
        description: "INSERTS into SalesInvoices, auto-creates customer if new, and DEDUCTS stock from ProductsTable (-qty). Returns 400 if insufficient stock.",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SaleInput" } } } },
        responses: {
          200: { description: "Sale recorded + stock deducted" },
          400: { description: "Missing fields or insufficient stock" },
          401: { description: "Unauthorized" },
          404: { description: "Product not found" },
        },
      },
    },

    // ── Sale: Bulk ──
    "/rest/V1/integrations/shopmaster/sales/bulk-upsert": {
      post: {
        tags: ["Sales"],
        summary: "Bulk customer sales (max 15)",
        description: "Same as single sale but for multiple items. Each item processed independently.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sales"],
                properties: {
                  batch_id: { type: "string", example: "batch-001" },
                  sales: { type: "array", maxItems: 15, items: { $ref: "#/components/schemas/SaleInput" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Bulk result with per-item status" },
          400: { description: "Validation error or >15 items" },
        },
      },
    },

    // ── Order Notify ──
    "/rest/V1/integrations/shopmaster/order/notify": {
      post: {
        tags: ["Orders"],
        summary: "Send order email to admin",
        description: "Sends HTML email to webmastersmma@gmail.com via Resend.",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderNotifyInput" } } } },
        responses: {
          200: { description: "Email sent" },
          400: { description: "Invalid type or missing fields" },
          500: { description: "Email send failed" },
        },
      },
    },
  },
};
