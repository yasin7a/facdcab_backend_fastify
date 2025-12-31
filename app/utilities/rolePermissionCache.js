import { prisma } from "../lib/prisma.js";

const cache = new Map();
const permissionSetCache = new Map();
const loadingPromises = new Map();

async function loadPermissions(roleId) {
  if (!roleId) return [];

  if (loadingPromises.has(roleId)) {
    return loadingPromises.get(roleId);
  }

  const loadPromise = (async () => {
    try {
      const permissions = await prisma.permission.findMany({
        where: {
          role_id: roleId,
          is_permit: true,
        },
        select: {
          module: true,
          operation: true,
        },
      });

      cache.set(roleId, permissions);

      const permissionSet = new Set(
        permissions.map((p) => `${p.module}:${p.operation}`)
      );
      permissionSetCache.set(roleId, permissionSet);

      return permissions;
    } catch (error) {
      // If DB fails, don't cache undefined/null
      cache.delete(roleId);
      permissionSetCache.delete(roleId);
      throw error;
    } finally {
      loadingPromises.delete(roleId);
    }
  })();

  loadingPromises.set(roleId, loadPromise);
  return loadPromise;
}

async function getPermissions(roleId) {
  if (cache.has(roleId)) {
    return cache.get(roleId);
  }
  return loadPermissions(roleId);
}

async function hasPermission(roleId, module, operation) {
  if (!permissionSetCache.has(roleId)) {
    await getPermissions(roleId);
  }

  const permissionSet = permissionSetCache.get(roleId);
  return permissionSet?.has(`${module}:${operation}`) ?? false;
}

function invalidatePermissionCache(roleId) {
  cache.delete(roleId);
  permissionSetCache.delete(roleId);
  loadingPromises.delete(roleId); // Also clear any pending loads
}

export { getPermissions, hasPermission, invalidatePermissionCache };
