// Central error type. The error handler turns these into the JSON shape
// the spec requires: { success:false, message, code }
export class ApiError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// 400
export const badRequest = (message, code) =>
  new ApiError(400, message, code ?? "bad_request");

// 401
export const unauthorized = (message = "Missing or invalid integration token.", code) =>
  new ApiError(401, message, code ?? "unauthorized");

// 404
export const notFound = (message, code) =>
  new ApiError(404, message, code ?? "not_found");

// 409
export const conflict = (message, code) =>
  new ApiError(409, message, code ?? "conflict");

// 422
export const unprocessable = (message, code) =>
  new ApiError(422, message, code ?? "unprocessable");

// 500
export const serverError = (message = "Unexpected server error.") =>
  new ApiError(500, message, "server_error");
