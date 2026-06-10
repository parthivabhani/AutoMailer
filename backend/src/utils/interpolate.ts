/**
 * interpolate.ts — Robust template variable interpolation engine
 *
 * Scans a template string for {variable} placeholders and replaces them
 * with values from a recipient data object. Matches case-insensitively
 * and handles fallbacks gracefully.
 */

interface InterpolateOptions {
  /** Default fallbacks if key is not found in lead record */
  fallbacks?: Record<string, string>;
}

/**
 * Interpolates variables in format {variable} in the template.
 *
 * Example:
 *   interpolate("Hi {FirstName}, how is {Company}?", { firstname: "John", company: "Google" })
 *   => "Hi John, how is Google?"
 */
export function interpolate(
  template: string,
  data: Record<string, any>,
  options: InterpolateOptions = {},
): string {
  if (!template) return "";
  let result = template;

  // Build a lookup map of lowercased keys for case-insensitive matching
  const lookup: Record<string, string> = {};
  for (const [key, val] of Object.entries(data)) {
    lookup[key.toLowerCase()] = String(val ?? "");
  }

  // Find all placeholder patterns: {some_variable_name}
  const placeholderRegex = /\{([a-zA-Z0-9_\-\s]+)\}/g;

  result = result.replace(placeholderRegex, (match, keyName) => {
    const cleanKey = keyName.trim().toLowerCase();

    // 1. Try lead data
    if (cleanKey in lookup) {
      return lookup[cleanKey];
    }

    // 2. Try common aliases (e.g. name / first_name / firstname)
    if (cleanKey === "name" || cleanKey === "firstname" || cleanKey === "first_name") {
      const nameVal = lookup.name || lookup.firstname || lookup.first_name || lookup.recipient_name;
      if (nameVal !== undefined) return nameVal;
    }

    if (cleanKey === "company" || cleanKey === "companyname" || cleanKey === "company_name") {
      const companyVal = lookup.company || lookup.companyname || lookup.company_name;
      if (companyVal !== undefined) return companyVal;
    }

    // 3. Try custom options fallbacks
    if (options.fallbacks && cleanKey in options.fallbacks) {
      return options.fallbacks[cleanKey];
    }

    // 4. Default general fallbacks
    if (cleanKey === "name" || cleanKey === "firstname" || cleanKey === "first_name") {
      return "there";
    }
    if (cleanKey === "company") {
      return "your company";
    }

    // If no match and no fallback, keep the placeholder or return empty
    // Keeping the placeholder makes it easier to debug, but returning empty is safer for B2B.
    // Let's return the placeholder so the sender knows something went wrong.
    return match;
  });

  return result;
}

/**
 * Scans a template and returns a list of unique variables used (without curly braces).
 */
export function extractVariables(template: string): string[] {
  if (!template) return [];
  const matches = template.match(/\{([a-zA-Z0-9_\-\s]+)\}/g) || [];
  const variables = matches.map((m) => m.slice(1, -1).trim());
  return [...new Set(variables)];
}
