import type { AreaKey, Role } from "@/lib/types";

export const moduleAccessKeys = {
  commercial: "module_commercial",
} as const;

export type ModuleKey = keyof typeof moduleAccessKeys;

type ModuleAccessUser = {
  role: Role;
  area?: AreaKey;
  areas?: AreaKey[];
};

export function canAccessModule(user: ModuleAccessUser | null | undefined, module: ModuleKey) {
  if (!user || user.role === "viewer") return false;
  if (user.role === "admin" || user.role === "manager") return true;
  return userAreas(user).includes(moduleAccessKeys[module]);
}

export function canEditCommercial(user: ModuleAccessUser, managersCanEditOrders: boolean) {
  return user.role === "admin"
    || (user.role === "manager" && managersCanEditOrders)
    || (user.role === "operator" && canAccessModule(user, "commercial"));
}

export function userAreas(user: Pick<ModuleAccessUser, "area" | "areas">) {
  if (user.areas?.length) return user.areas;
  return user.area ? [user.area] : [];
}
