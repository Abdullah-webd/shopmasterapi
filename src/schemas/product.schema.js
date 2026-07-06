import { z } from "zod";

// Accepted skin-type labels per the spec.
const SKIN_TYPE_LABELS = [
  "Oily",
  "Dry",
  "Combination",
  "Sensitive",
  "Normal",
  "All Skin Types",
];

// Whole Naira, integer, non-negative. Rejects floats, strings, negatives.
const nairaInt = z
  .number()
  .int("price must be an integer (whole Naira)")
  .nonnegative("price must be non-negative");

// ---------------------------------------------------------------------------
// Inventory block (single location enforced by shape + DB constraint)
// ---------------------------------------------------------------------------
const inventorySchema = z.object({
  stock_qty: z
    .number()
    .int()
    .nonnegative("inventory.stock_qty must be non-negative"),
  low_stock_alert: z
    .number()
    .int()
    .nonnegative("inventory.low_stock_alert must be non-negative"),
  location: z.object({
    location_id: z.number().int().positive().optional(),
    location_name: z.string().min(1).optional(),
    qty: z.number().int().nonnegative(),
  }),
}).superRefine((inv, ctx) => {
  // At least one identifier must be sent.
  if (inv.location.location_id === undefined && !inv.location.location_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["location"],
      message:
        "inventory.location.location_id or inventory.location.location_name is required",
    });
  }
});

// ---------------------------------------------------------------------------
// A single product payload (shared by single + bulk endpoints)
// ---------------------------------------------------------------------------
const productBaseSchema = z.object({
  external_product_id: z.string().min(1),
  external_variant_id: z.string().min(1).optional(),

  sku: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["active", "inactive", "draft", "archived"]),
  price: nairaInt,
  weight: z.number().nonnegative().optional(),
  description: z.string().min(1),
  ingredients: z.string().min(1),
  how_to_use: z.string().optional(),

  brand: z.string().optional(),
  brand_ids: z.array(z.number().int().positive()).optional(),
  primary_brand_id: z.number().int().positive().optional(),

  // category: send ids OR names (checked in service layer)
  category_ids: z.array(z.number().int().positive()).optional(),
  category_names: z.array(z.string().min(1)).optional(),

  // skin type: send ids OR names
  skin_type_ids: z.array(z.number().int().positive()).optional(),
  skin_type_names: z
    .array(z.string().min(1))
    .optional()
    .refine(
      (names) => !names || names.every((n) => SKIN_TYPE_LABELS.includes(n)),
      `skin_type_names must be one of: ${SKIN_TYPE_LABELS.join(", ")}`
    ),

  tags: z.array(z.string().min(1)).optional(),
  allergens: z.array(z.string()).optional(),

  inventory: inventorySchema,

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
});

function validateProductRules(p, ctx) {
  // primary_brand_id (if sent) must be one of brand_ids
  if (
    p.primary_brand_id !== undefined &&
    Array.isArray(p.brand_ids) &&
    p.brand_ids.length > 0 &&
    !p.brand_ids.includes(p.primary_brand_id)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["primary_brand_id"],
      message: "primary_brand_id must be one of brand_ids",
    });
  }
  // category: must send at least one of ids/names
  if (
    (!p.category_ids || p.category_ids.length === 0) &&
    (!p.category_names || p.category_names.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["category_ids"],
      message: "category_ids or category_names is required",
    });
  }
  // skin type: must send at least one of ids/names
  if (
    (!p.skin_type_ids || p.skin_type_ids.length === 0) &&
    (!p.skin_type_names || p.skin_type_names.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["skin_type_ids"],
      message: "skin_type_ids or skin_type_names is required",
    });
  }
}

export const productSchema = productBaseSchema.superRefine(validateProductRules);

// ---------------------------------------------------------------------------
// Single upsert wrapper (the product object sits at the top level)
// ---------------------------------------------------------------------------
export const singleUpsertSchema = productBaseSchema
  .extend({
    source: z.string().optional(),
  })
  .superRefine(validateProductRules);

// ---------------------------------------------------------------------------
// Bulk upsert wrapper
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers to turn a ZodError into a clean 400 response body
// ---------------------------------------------------------------------------
export function formatZodError(error) {
  // { success:false, message, code, details:[...] }
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
