export function normalizeRoles(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((value): value is string => typeof value === "string");
  }

  if (typeof input === "string") {
    return [input];
  }

  if (input && typeof input === "object") {
    return Object.values(input).filter((value): value is string => typeof value === "string");
  }

  return [];
}

export function getDefaultAuthedRoute(input: unknown): string {
  const roles = normalizeRoles(input);

  if (roles.includes("driver")) {
    return "DriverHub";
  }

  if (roles.includes("admin")) {
    return "Markets";
  }

  if (roles.includes("owner") || roles.includes("staff")) {
    return "MyMarkets";
  }

  return "Orders";
}
