import { z } from "zod";

// Whole Naira, integer, non-negative.
const nairaInt = z
  .number()
  .int("price must be an integer (whole Naira)")
  .nonnegative("price must be non-negative");

// Simplified inventory — only fields that map to ProductsTable
const inventorySchema = z.object({
  stock_qty: z
    .number()
    .int()
    .nonnegative("inventory.stock_qty must be non-negative"),
  low_stock_alert: z
    .number()
    .int()
    .nonnegative("inventory.low_stock_alert must be non-negative"),
  location: z
    .object({
      location_id: z.number().int().positive().optional(),
      location_name: z.string().min(1).optional(),
      qty: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

// A single product payload — only requires fields that ProductsTable needs
const productBaseSchema = z.object({
  external_product_id: z.string().min(1),
  external_variant_id: z.string().optional(),

  sku: z.string().optional(),
  name: z.string().min(1),
  status: z.enum(["active", "inactive", "draft", "archived"]),
  price: nairaInt,

  // These are accepted but NOT stored (no matching ProductsTable columns)
  weight: z.number().nonnegative().optional(),
  description: z.string().optional(),
  ingredients: z.string().optional(),
  how_to_use: z.string().optional(),
  brand: z.string().optional(),
  brand_ids: z.array(z.number().int().positive()).optional(),
  primary_brand_id: z.number().int().positive().optional(),
  category_ids: z.array(z.number().int().positive()).optional(),
  category_names: z.array(z.string().min(1)).optional(),
  skin_type_ids: z.array(z.number().int().positive()).optional(),
  skin_type_names: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
  allergens: z.array(z.string()).optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string().optional(),
        position: z.number().int().optional(),
        is_primary: z.boolean().optional(),
      })
    )
    .optional(),
  event: z
    .object({
      id: z.string().min(1),
      type: z.string().optional(),
      occurred_at: z.string().optional(),
    })
    .optional(),

  inventory: inventorySchema,
});

export const productSchema = productBaseSchema;

// Single upsert wrapper
export const singleUpsertSchema = productBaseSchema.extend({
  source: z.string().optional(),
});

// Bulk upsert
export const BULK_MIN = 1;
export const BULK_RECOMMENDED_MAX = 10;
export const BULK_HARD_MAX = 15;

export const bulkUpsertSchema = z
  .object({
    source: z.string().optional(),
    batch_id: z.string().min(1),
    products: z.array(productSchema).min(BULK_MIN),
  })
  .superRefine((b, ctx) => {
    if (b.products.length > BULK_HARD_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["products"],
        message: `bulk-upsert allows a maximum of ${BULK_HARD_MAX} products per request`,
      });
    }
  });

// ZodError → clean 400 body
export function formatZodError(error) {
  const details = error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
  return {
    success: false,
    message: "Validation failed.",
    code: "validation_error",
    details,
  };
}
