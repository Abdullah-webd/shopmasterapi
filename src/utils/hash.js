import { createHash } from "node:crypto";

// Stable hash of the request body, used for idempotency replay checks.
export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
