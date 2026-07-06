import { sql } from "../config/db.js";
import { notFound } from "../utils/httpErrors.js";

function request(txn) {
  return new sql.Request(txn);
}

// ---------------------------------------------------------------------------
// Generic "id-or-name" resolver.
// Prefers IDs (per spec). Falls back to names. 404s on unknown.
//
// Each helper runs inside the caller's transaction (uses the passed request).
// ---------------------------------------------------------------------------

// Resolve a single location by id or name. Returns { location_id }.
export async function resolveLocation(txn, { location_id, location_name }) {
  if (location_id !== undefined) {
    const r = await request(txn)
      .input("lid", sql.Int, location_id)
      .query(`SELECT location_id FROM dbo.locations WHERE location_id = @lid`);
    if (r.recordset.length === 0) {
      throw notFound(`Location id ${location_id} not found.`, "location_not_found");
    }
    return { location_id };
  }
  const r = await request(txn)
    .input("lname", sql.NVarChar(255), location_name)
    .query(`SELECT location_id FROM dbo.locations WHERE name = @lname`);
  if (r.recordset.length === 0) {
    throw notFound(`Location "${location_name}" not found.`, "location_not_found");
  }
  return { location_id: r.recordset[0].location_id };
}

// Resolve categories. Prefers ids; falls back to names. 404 on any miss.
export async function resolveCategories(txn, ids, names) {
  if (ids && ids.length) {
    const rows = await findByIds(txn, "categories", "category_id", ids);
    if (rows.length !== ids.length) {
      throw notFound("One or more category_ids not found.", "category_not_found");
    }
    return ids;
  }
  const found = await findByNames(txn, "categories", "category_id", names);
  if (found.length !== names.length) {
    throw notFound("One or more category_names not found.", "category_not_found");
  }
  return found.map((r) => r.id);
}

// Resolve skin types. Same rules.
export async function resolveSkinTypes(txn, ids, names) {
  if (ids && ids.length) {
    const rows = await findByIds(txn, "skin_types", "skin_type_id", ids);
    if (rows.length !== ids.length) {
      throw notFound("One or more skin_type_ids not found.", "skin_type_not_found");
    }
    return ids;
  }
  const found = await findByNames(txn, "skin_types", "skin_type_id", names);
  if (found.length !== names.length) {
    throw notFound("One or more skin_type_names not found.", "skin_type_not_found");
  }
  return found.map((r) => r.id);
}

// Resolve brand. brand_ids preferred; falls back to brand text.
// Returns { brand_id } or null when nothing sent.
export async function resolveBrand(txn, product) {
  const ids = product.brand_ids;
  if (ids && ids.length) {
    const rows = await findByIds(txn, "brands", "brand_id", ids);
    if (rows.length !== ids.length) {
      throw notFound("One or more brand_ids not found.", "brand_not_found");
    }
    // primary_brand_id wins (validated to be in brand_ids by zod); else first.
    const chosen = product.primary_brand_id ?? ids[0];
    return { brand_id: chosen };
  }
  if (product.brand) {
    // Create the brand lazily if it doesn't exist (brand is a free-text field).
    const r = await request(txn)
      .input("bname", sql.NVarChar(255), product.brand)
      .query(
        `MERGE dbo.brands WITH (HOLDLOCK) AS target
         USING (SELECT @bname AS name) AS source
         ON target.name = source.name
         WHEN NOT MATCHED THEN INSERT (name) VALUES (source.name);
         SELECT brand_id FROM dbo.brands WHERE name = @bname;`
      );
    return { brand_id: r.recordset[0].brand_id };
  }
  return { brand_id: null };
}

// --- internal helpers ------------------------------------------------------

async function findByIds(txn, table, idCol, ids) {
  // Build an IN list safely with parameter placeholders.
  const params = ids
    .map((_, i) => `@id${i}`)
    .join(",");
  const req = request(txn);
  ids.forEach((id, i) => req.input(`id${i}`, sql.Int, id));
  const r = await req.query(
    `SELECT ${idCol} AS id FROM dbo.${table} WHERE ${idCol} IN (${params})`
  );
  return r.recordset;
}

async function findByNames(txn, table, idCol, names) {
  const params = names
    .map((_, i) => `@n${i}`)
    .join(",");
  const req = request(txn);
  names.forEach((n, i) => req.input(`n${i}`, sql.NVarChar(255), n));
  const r = await req.query(
    `SELECT ${idCol} AS id, name FROM dbo.${table} WHERE name IN (${params})`
  );
  return r.recordset;
}

// Resolve-or-create tags (free text). Returns tag_ids.
export async function resolveTags(txn, names) {
  if (!names || !names.length) return [];
  // MERGE all at once isn't trivial; loop is fine for small tag lists.
  const ids = [];
  for (const name of names) {
    const r = await request(txn).input("tname", sql.NVarChar(255), name).query(
      `MERGE dbo.tags WITH (HOLDLOCK) AS target
       USING (SELECT @tname AS name) AS source
       ON target.name = source.name
       WHEN NOT MATCHED THEN INSERT (name) VALUES (source.name);
       SELECT tag_id AS id FROM dbo.tags WHERE name = @tname;`
    );
    ids.push(r.recordset[0].id);
  }
  return ids;
}
