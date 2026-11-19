export const accessModules = ["dashboard", "compare", "documents", "templates", "editor", "history", "approvals", "company"] as const;
export type AccessModule = typeof accessModules[number];
const allModules = [...accessModules];

export function defaultPermissions(role: string): AccessModule[] {
  return role === "admin" ? [...allModules] : [...allModules];
}

export function effectivePermissions(user: { role: string; permissions?: AccessModule[] | null }): AccessModule[] {
  return user.role === "admin" ? [...allModules] : user.permissions ? user.permissions.filter((value): value is AccessModule => accessModules.includes(value)) : defaultPermissions(user.role);
}

export function canAccessModule(user: { role: string; permissions?: AccessModule[] | null } | null | undefined, module: string): boolean {
  if (!user) return true;
  if (user.role === "admin") return true;
  return effectivePermissions(user).includes(module as AccessModule);
}
