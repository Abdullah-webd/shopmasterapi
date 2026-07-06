import { ApiError, serverError } from "../utils/httpErrors.js";

// Central error handler. Mount LAST, after all routes.
// Converts ApiError into the spec's JSON shape, falls back to 500 otherwise.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const error = err instanceof ApiError ? err : serverError();

  if (error.status >= 500) {
    console.error("[errorHandler]", err);
  }

  const payload = { success: false, message: error.message };
  if (error.code) payload.code = error.code;

  res.status(error.status).json(payload);
}
