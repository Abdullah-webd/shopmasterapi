import { env } from "../config/env.js";
import { unauthorized } from "../utils/httpErrors.js";
import { timingSafeEqual as safeEqual } from "node:crypto";

// Validates: Authorization: Bearer <INTEGRATION_TOKEN>
// Uses timingSafeEqual to avoid timing leaks.
export function auth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (
    scheme !== "Bearer" ||
    !token ||
    !timingSafeEqual(token, env.integrationToken)
  ) {
    return next(unauthorized());
  }
  next();
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return safeEqual(bufA, bufB);
}
