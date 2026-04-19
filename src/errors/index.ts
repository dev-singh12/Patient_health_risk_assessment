/**
 * Application error hierarchy.
 *
 * Every custom error extends AppError so that the global error handler can
 * distinguish application-level errors from unexpected runtime errors and map
 * them to the correct HTTP status codes.
 *
 * `Object.setPrototypeOf(this, new.target.prototype)` is called in every
 * constructor to restore the correct prototype chain after TypeScript compiles
 * the class to ES5-style constructor functions, ensuring `instanceof` checks
 * work correctly at runtime.
 */

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 422 — request body failed schema validation.
 * The optional `fields` map carries per-field violation messages.
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message, 422, "VALIDATION_ERROR");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 401 — no valid JWT was presented or the token has expired.
 */
export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 403 — the authenticated user lacks the required role or is attempting
 * to access another user's data.
 */
export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 404 — the requested resource does not exist or has been soft-deleted.
 * Pass the resource name (e.g. "Patient", "ClinicalData") as the argument.
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 409 — a conflicting state was detected (e.g. duplicate email,
 * in-flight idempotency key).
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 500 — a stage of the assessment pipeline threw an unexpected error.
 * Carries the failing stage name and the request correlation ID so that the
 * global error handler can include them in the structured error response.
 */
export class PipelineError extends AppError {
  constructor(
    public readonly stageName: string,
    public readonly correlationId: string,
    cause?: Error,
  ) {
    super(`Pipeline failed at stage: ${stageName}`, 500, "PIPELINE_ERROR");
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 400 — the ML Risk Engine received a metrics object with one or more
 * required fields missing or undefined.
 */
export class InvalidMetricsError extends AppError {
  constructor(missingFields: string[]) {
    super(
      `Invalid metrics: missing required fields: ${missingFields.join(", ")}`,
      400,
      "INVALID_METRICS",
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
