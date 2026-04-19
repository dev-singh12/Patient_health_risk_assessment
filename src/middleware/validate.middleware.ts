import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors";

/**
 * Converts a `ZodError` into a flat `Record<string, string>` map where each
 * key is the dot-joined field path and the value is the first error message
 * for that field.
 */
function zodErrorToFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fields[path]) {
      fields[path] = issue.message;
    }
  }

  return fields;
}

/**
 * Validation middleware factory.
 *
 * Returns an Express `RequestHandler` that parses `req.body` against the
 * provided Zod schema using `safeParse`. On success, `req.body` is replaced
 * with the parsed (and potentially transformed) data before calling `next()`.
 * On failure, a `ValidationError` is thrown with a per-field error map,
 * ensuring no business logic executes after a validation failure.
 *
 * Usage:
 * ```typescript
 * router.post("/patients", validate(CreatePatientSchema), handler);
 * ```
 *
 * Validates: Requirements 10.2, 4.2
 */
export function validate(schema: ZodSchema): RequestHandler {
  return function validateMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields = zodErrorToFields(result.error);
      return next(
        new ValidationError("Request body validation failed", fields),
      );
    }

    req.body = result.data;
    next();
  };
}
