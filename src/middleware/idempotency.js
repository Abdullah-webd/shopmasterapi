import { sql, getPool } from "../config/db.js";
import { sha256 } from "../utils/hash.js";

// Idempotency middleware.
//
// On the FIRST request with a given key:
//   - record (key, body-hash, status, body) AFTER the handler runs
//   - so a retry replays the exact same response.
//
// On a RETRY with the same key:
//   - if the body hash matches  -> replay the stored response
//   - if the body hash differs  -> 409 (key reused for a different payload)
//
// If no Idempotency-Key header is present, this middleware is a no-op.
export async function idempotency(req, res, next) {
  const key = req.get("idempotency-key");

  if (!key) {
    // No header → still process, just skip replay logic.
    req.idempotencyKey = null;
    return next();
  }

  const requestHash = sha256(JSON.stringify(req.body) || "");
  req.idempotencyKey = key;

  try {
    const pool = await getPool();
    const lookup = await pool
      .request()
      .input("key", sql.NVarChar(200), key)
      .query(
        `SELECT response_status, response_body, request_hash
         FROM dbo.idempotency_keys
         WHERE idempotency_key = @key`
      );

    if (lookup.recordset.length > 0) {
      const row = lookup.recordset[0];
      if (row.request_hash !== requestHash) {
        // Same key, different payload — that's a client error.
        return res.status(409).json({
          success: false,
          message: "Idempotency key was already used for a different payload.",
          code: "idempotency_key_reuse",
        });
      }
      // Replay the original response.
      const body = JSON.parse(row.response_body);
      return res.status(row.response_status).json(body);
    }

    // Not seen yet. Let the handler run, then persist its response.
    // We intercept res.json to capture the body+status.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode;
      const response = originalJson(body);

      pool
        .request()
        .input("key", sql.NVarChar(200), key)
        .input("hash", sql.NVarChar(64), requestHash)
        .input("status", sql.Int, status)
        .input("body", sql.NVarChar(sql.MAX), JSON.stringify(body))
        .query(
          `INSERT INTO dbo.idempotency_keys
             (idempotency_key, request_hash, response_status, response_body)
           VALUES (@key, @hash, @status, @body)`
        )
        .catch((err) => {
          // Failing to record idempotency shouldn't break the response.
          console.error("[idempotency] persist failed:", err.message);
        });

      return response;
    };

    next();
  } catch (err) {
    next(err);
  }
}
