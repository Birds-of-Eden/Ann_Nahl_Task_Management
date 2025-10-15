// lib/permissions-client.ts

export function hasPermissionClient(
  userPermissions: Array<string | number> | undefined,
  permission: string
) {
  if (!userPermissions) return false;
  const set = new Set(userPermissions.map(String));
  return set.has(permission);
}
