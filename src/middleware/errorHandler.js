import { ApiError, serverError } from "../utils/httpErrors.js";

export function errorHandler(err, req, res, next) {
  const error = err instanceof ApiError ? err : serverError();

  console.error("[errorHandler]", err);

  const payload = { success: false, message: error.message };
  if (error.code) payload.code = error.code;

  // DEBUG: expose original error while troubleshooting
  payload.debug = {
    originalMessage: err.message || String(err),
    originalCode: err.code || null,
    originalNumber: err.number || null,
  };

  res.status(error.status).json(payload);
}