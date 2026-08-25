/**
 * Recursively sanitizes any value, stripping HTML tags from all string properties
 * to mitigate XSS (Cross-Site Scripting) injection attacks.
 */
export function sanitizeInput<T>(val: T): T {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val === "string") {
    // Strip HTML tags using regex
    return val.replace(/<[^>]*>/g, "").trim() as any;
  }

  if (Array.isArray(val)) {
    return val.map(item => sanitizeInput(item)) as any;
  }

  if (typeof val === "object") {
    const sanitizedObj: any = {};
    for (const key of Object.keys(val)) {
      sanitizedObj[key] = sanitizeInput((val as any)[key]);
    }
    return sanitizedObj as T;
  }

  return val;
}
