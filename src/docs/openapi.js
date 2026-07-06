export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Shopmaster Integration API",
    version: "4.0.0",
    description: "Product catalog, supplier management, stock purchases, customer sales with auto-email. All endpoints write to existing SBasic000 tables.\n\n![Workflow Diagram](/workflow.png)",
  },
  servers: [
    { url: "https://shopmasterapi.onrender.com", description: "Production (Render)" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  tags: [
    { name: "System" },
    { name: "Products", description: "Product listing" },
    { name: "Suppliers", description: "Supplier management" },
    { name: "Purchases", description: "Stock purchases → validates supplier, +stock" },
    { name: "Sales", description: "Customer sales → auto-creates customer, -stock, auto-email" },
    { name: "Orders", description: "Email notifications" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "token" } },
    schemas: {
      ApiError: { type: "object", properties: { success: { type: "boolean", example: false }, message: { type: "string" }, code: { type: "string" } } },
      SupplierInput: {
        type: "object", required: ["supplierid", "suppliername"],
        properties: {
          supplierid: { type: "string", example: "SUP-001" },
          suppliername: { type: "string", example: "ABC Beauty Wholesale" },
          phone: { type: "string", example: "08031234567" },
          email: { type: "string", example: "abc@supplier.com" },
          address: { type: "string", example: "12 Marina Rd, Lagos" },
          city: { type: "string", example: "Lagos" },
          state: { type: "string", example: "Lagos" },
        },
      },
      PurchaseInput: {
        type: "object", required: ["invoiceno", "productid", "qty"],
        properties: {
          supplierid: { type: "string", example: "SUP-001", description: "Must exist in Suppliers table" },
          invoiceno: { type: "string", example: "PINV-2026-00042" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06" },
          productid: { type: "string", example: "SM-PROD-10001" },
          productname: { type: "string", example: "Milk Facial Toner", description: "Used if product doesn't exist yet" },
          costprice: { type: "number", example: 8000 },
          sellprice: { type: "number", example: 18000 },
          qty: { type: "number", example: 50 },
        },
      },
      SaleInput: {
        type: "object", required: ["invoicenumber", "productid", "qty"],
        properties: {
          customerid: { type: "string", example: "CUST-042" },
          customername: { type: "string", example: "Ajala Abdullah", description: "Required if customer is new" },
          customerphone: { type: "string", example: "08012345678" },
          customeremail: { type: "string", example: "ajala@email.com" },
          customeraddress: { type: "string", example: "15 Allen Ave, Ikeja" },
          invoicenumber: { type: "string", example: "SINV-2026-01023" },
          invoicedate: { type: "string", format: "date", example: "2026-07-06" },
          productid: { type: "string", example: "SM-PROD-10001" },
          costprice: { type: "number", example: 8000 },
          sellprice: { type: "number", example: 18000 },
          qty: { type: "number", example: 2 },
        },
      },
      OrderNotifyInput: {
        type: "object", required: ["type", "invoiceno", "productid", "qty", "amount"],
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
          customerid: { type: "string", example: "CUST-042" },
        },
      },
    },
  },
  paths: {
    "/health": { get: { tags: ["System"], summary: "Health check", responses: { 200: { description: "ok" } } } },

    "/rest/V1/integrations/shopmaster/products": {
      get: {
        tags: ["Products"], summary: "List all products",
        description: "Fetches from dbo.ProductsTable with live stock levels.", security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Product list" }, 401: { description: "Unauthorized" } },
      },
    },

    "/rest/V1/integrations/shopmaster/supplier/upsert": {
      post: {
        tags: ["Suppliers"], summary: "Add or update a supplier",
        description: "Creates or updates a row in dbo.Suppliers. Call before first purchase from a new supplier.", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SupplierInput" } } } },
        responses: { 200: { description: "Supplier created/updated" }, 400: { description: "Missing fields" }, 401: { description: "Unauthorized" } },
      },
    },

    "/rest/V1/integrations/shopmaster/purchase/upsert": {
      post: {
        tags: ["Purchases"], summary: "Record a stock purchase",
        description: "Validates supplier exists → inserts PurchaseInvoices → adds stock to ProductsTable (+qty). Auto-creates product if new.", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseInput" } } } },
        responses: { 200: { description: "Purchase recorded + stock updated" }, 400: { description: "Missing fields" }, 401: { description: "Unauthorized" }, 404: { description: "Supplier not found" } },
      },
    },

    "/rest/V1/integrations/shopmaster/purchase/bulk-upsert": {
      post: {
        tags: ["Purchases"], summary: "Bulk stock purchases (max 15)",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["purchases"], properties: { batch_id: { type: "string", example: "batch-001" }, purchases: { type: "array", maxItems: 15, items: { $ref: "#/components/schemas/PurchaseInput" } } } } } } },
        responses: { 200: { description: "Bulk result" }, 400: { description: "Validation error" } },
      },
    },

    "/rest/V1/integrations/shopmaster/sales/upsert": {
      post: {
        tags: ["Sales"], summary: "Record a customer sale",
        description: "Auto-creates customer if new → validates product + stock → inserts SalesInvoices → deducts stock (-qty) → auto-sends email to admin.", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SaleInput" } } } },
        responses: { 200: { description: "Sale recorded, stock deducted, email sent" }, 400: { description: "Insufficient stock" }, 401: { description: "Unauthorized" }, 404: { description: "Product not found" } },
      },
    },

    "/rest/V1/integrations/shopmaster/sales/bulk-upsert": {
      post: {
        tags: ["Sales"], summary: "Bulk customer sales (max 15)",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["sales"], properties: { batch_id: { type: "string", example: "batch-001" }, sales: { type: "array", maxItems: 15, items: { $ref: "#/components/schemas/SaleInput" } } } } } } },
        responses: { 200: { description: "Bulk result" }, 400: { description: "Validation error" } },
      },
    },

    "/rest/V1/integrations/shopmaster/order/notify": {
      post: {
        tags: ["Orders"], summary: "Send order email to admin",
        description: "Auto-called by sales endpoints. Sends HTML email to webmastersmma@gmail.com via Resend.", security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderNotifyInput" } } } },
        responses: { 200: { description: "Email sent" }, 400: { description: "Invalid fields" }, 500: { description: "Send failed" } },
      },
    },
  },
};
