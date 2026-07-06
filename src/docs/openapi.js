export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Shopmaster Integration API",
    version: "2.0.0",
    description:
      "API for Shopmaster product sync, purchase/sales invoice management, and order email notifications. All endpoints write to existing SBasic000 tables.",
  },
  servers: [
    {
      url: "https://shopmasterapi.onrender.com",
      description: "Production (Render)",
    },
    {
      url: "http://localhost:3000",
      description: "Local development",
    },
  ],
  tags: [
    { name: "System", description: "Health & status" },
    { name: "Products", description: "Product catalog sync from Shopmaster" },
    { name: "Invoices", description: "Purchase & sales invoice records" },
    { name: "Orders", description: "Email notifications for orders" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "token",
        description: "Integration token from .env INTEGRATION_TOKEN",
      },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Validation failed." },
          code: { type: "string", example: "bad_request" },
        },
      },
      ProductInput: {
        type: "object",
        properties: {
          external_product_id: { type: "string", example: "SM-PROD-10001", description: "Stable Shopmaster product ID → ProductsTable.ProductID" },
          sku: { type: "string", example: "TUL-BLO-001", description: "→ ProductsTable.POSName (first 20 chars)" },
          name: { type: "string", example: "Milk Facial Toner", description: "→ ProductsTable.ProductName" },
          status: { type: "string", enum: ["active", "inactive", "draft", "archived"], example: "active", description: "→ ProductsTable.Satus (1=active, 0=other)" },
          price: { type: "integer", example: 18000, description: "→ ProductsTable.SellPrice" },
          inventory: {
            type: "object",
            properties: {
              stock_qty: { type: "integer", example: 30, description: "→ ProductsTable.QtyInStock" },
              low_stock_alert: { type: "integer", example: 5, description: "→ ProductsTable.ReOrderLevel" },
            },
            required: ["stock_qty", "low_stock_alert"],
          },
        },
        required: ["external_product_id", "name", "price", "inventory"],
      },
      ProductResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          operation: { type: "string", enum: ["created", "updated"], example: "created" },
          product: {
            type: "object",
            properties: {
              product_id: { type: "string", example: "SM-PROD-10001" },
              name: { type: "string", example: "Milk Facial Toner" },
              price: { type: "integer", example: 18000 },
              stock: { type: "integer", example: 30 },
              updated_at: { type: "string", example: "2026-07-06 07:50:00" },
            },
          },
        },
      },
      ProductListItem: {
        type: "object",
        properties: {
          product_id: { type: "string", example: "SM-PROD-10001" },
          external_product_id: { type: "string", example: "SM-PROD-10001" },
          sku: { type: "string", example: "TUL-BLO-001" },
          name: { type: "string", example: "Milk Facial Toner" },
          status: { type: "string", example: "active" },
          price: { type: "integer", example: 18000 },
          inventory: {
            type: "object",
            properties: {
              stock_qty: { type: "integer", example: 30 },
              low_stock_alert: { type: "integer", example: 5 },
            },
          },
        },
      },
      ProductListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 50 },
          total: { type: "integer", example: 145 },
          products: {
            type: "array",
            items: { $ref: "#/components/schemas/ProductListItem" },
          },
        },
      },
      BulkUpsertInput: {
        type: "object",
        properties: {
          source: { type: "string", example: "shopmaster" },
          batch_id: { type: "string", example: "batch_20260616_001" },
          products: {
            type: "array",
            maxItems: 15,
            items: { $ref: "#/components/schemas/ProductInput" },
          },
        },
        required: ["batch_id", "products"],
      },
      PurchaseInvoiceInput: {
        type: "object",
        properties: {
          supplierid: { type: "string", example: "SUP-001", description: "→ PurchaseInvoices.SupplierID" },
          invoiceno: { type: "string", example: "PINV-2026-00042", description: "→ PurchaseInvoices.InvoiceNo" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06", description: "→ PurchaseInvoices.InvoiceDate" },
          productid: { type: "string", example: "SM-PROD-10001", description: "→ PurchaseInvoices.ProductID" },
          costprice: { type: "integer", example: 8000, description: "→ PurchaseInvoices.CostPrice" },
          sellprice: { type: "integer", example: 18000, description: "→ PurchaseInvoices.SellPrice" },
          qty: { type: "integer", example: 50, description: "→ PurchaseInvoices.Qty" },
        },
        required: ["invoiceno", "productid", "qty"],
      },
      SalesInvoiceInput: {
        type: "object",
        properties: {
          customerid: { type: "string", example: "CUST-042", description: "→ SalesInvoices.CustomerID" },
          invoicenumber: { type: "string", example: "SINV-2026-01023", description: "→ SalesInvoices.InvoiceNo" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06", description: "→ SalesInvoices.InvoiceDate" },
          productid: { type: "string", example: "SM-PROD-10001", description: "→ SalesInvoices.ProductID" },
          costprice: { type: "integer", example: 8000, description: "→ SalesInvoices.CostPrice" },
          sellprice: { type: "integer", example: 18000, description: "→ SalesInvoices.SellPrice" },
          qty: { type: "integer", example: 2, description: "→ SalesInvoices.Qty" },
        },
        required: ["invoicenumber", "productid", "qty"],
      },
      OrderNotifyInput: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["purchase", "sales"], example: "sales", description: "Order type" },
          invoiceno: { type: "string", example: "SINV-2026-01023", description: "Invoice number" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06" },
          productid: { type: "string", example: "SM-PROD-10001" },
          productname: { type: "string", example: "Milk Facial Toner" },
          qty: { type: "integer", example: 2 },
          costprice: { type: "integer", example: 8000 },
          sellprice: { type: "integer", example: 18000 },
          amount: { type: "integer", example: 36000 },
          supplierid: { type: "string", example: "SUP-001", description: "Required for type=purchase" },
          customerid: { type: "string", example: "CUST-042", description: "Required for type=sales" },
        },
        required: ["type", "invoiceno", "productid", "qty", "amount"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: {
            description: "Server is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },

    // ── Products ────────────────────────────────────────────────
    "/rest/V1/integrations/shopmaster/products": {
      get: {
        tags: ["Products"],
        summary: "List all products",
        description: "Fetches products from dbo.ProductsTable with pagination and search.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 }, description: "Items per page (max 100)" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by ProductID, ProductName, or POSName" },
        ],
        responses: {
          200: {
            description: "Product list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductListResponse" },
              },
            },
          },
          401: { description: "Missing or invalid token", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },

    "/rest/V1/integrations/shopmaster/products/upsert": {
      post: {
        tags: ["Products"],
        summary: "Single product upsert (create or update)",
        description: "Writes to dbo.ProductsTable. Updates if ProductID exists, inserts if new.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "Idempotency-Key", in: "header", schema: { type: "string" }, required: false, description: "Prevents duplicate processing" },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } },
        },
        responses: {
          200: { description: "Product created or updated", content: { "application/json": { schema: { $ref: "#/components/schemas/ProductResponse" } } } },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          401: { description: "Missing or invalid token" },
          409: { description: "Duplicate product conflict" },
        },
      },
    },

    "/rest/V1/integrations/shopmaster/products/bulk-upsert": {
      post: {
        tags: ["Products"],
        summary: "Bulk product upsert (max 15)",
        description: "Each product is processed independently. One failure does not stop the batch.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "Idempotency-Key", in: "header", schema: { type: "string" }, required: false },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BulkUpsertInput" } } },
        },
        responses: {
          200: {
            description: "Bulk result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    batch_id: { type: "string" },
                    total: { type: "integer" },
                    created: { type: "integer" },
                    updated: { type: "integer" },
                    failed: { type: "integer" },
                    items: { type: "array" },
                  },
                },
              },
            },
          },
          400: { description: "Validation error or >15 items" },
          401: { description: "Missing or invalid token" },
        },
      },
    },

    // ── Purchase Invoice ────────────────────────────────────────
    "/rest/V1/integrations/shopmaster/purchase/upsert": {
      post: {
        tags: ["Invoices"],
        summary: "Record a stock purchase from supplier",
        description: "Writes to dbo.PurchaseInvoices. Called when the company buys new stock.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseInvoiceInput" } } },
        },
        responses: {
          200: {
            description: "Purchase recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    operation: { type: "string", enum: ["created", "updated"] },
                    invoice: {
                      type: "object",
                      properties: {
                        invoiceno: { type: "string" },
                        productid: { type: "string" },
                        supplierid: { type: "string" },
                        qty: { type: "integer" },
                        costprice: { type: "integer" },
                        sellprice: { type: "integer" },
                        amount: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Missing required fields" },
          401: { description: "Missing or invalid token" },
        },
      },
    },

    // ── Sales Invoice ───────────────────────────────────────────
    "/rest/V1/integrations/shopmaster/sales/upsert": {
      post: {
        tags: ["Invoices"],
        summary: "Record a customer sale",
        description: "Writes to dbo.SalesInvoices. Called when a customer makes a purchase.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SalesInvoiceInput" } } },
        },
        responses: {
          200: {
            description: "Sale recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    operation: { type: "string", enum: ["created", "updated"] },
                    invoice: {
                      type: "object",
                      properties: {
                        invoicenumber: { type: "string" },
                        productid: { type: "string" },
                        customerid: { type: "string" },
                        qty: { type: "integer" },
                        costprice: { type: "integer" },
                        sellprice: { type: "integer" },
                        amount: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Missing required fields" },
          401: { description: "Missing or invalid token" },
        },
      },
    },

    // ── Order Email ─────────────────────────────────────────────
    "/rest/V1/integrations/shopmaster/order/notify": {
      post: {
        tags: ["Orders"],
        summary: "Send order email to admin",
        description: "Sends a formatted HTML email to webmastersmma@gmail.com via Resend. Call this after creating a purchase or sales invoice.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderNotifyInput" } } },
        },
        responses: {
          200: {
            description: "Email sent",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "Order email sent to webmastersmma@gmail.com" },
                    email_id: { type: "string", example: "abc123-def456" },
                  },
                },
              },
            },
          },
          400: { description: "Invalid type or missing fields" },
          401: { description: "Missing or invalid token" },
          500: { description: "Email send failed" },
        },
      },
    },
  },
};
