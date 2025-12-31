function groupPermissionsByModule(list = []) {
  return Object.values(
    list.reduce((acc, item) => {
      const { module } = item;
      if (!acc[module]) {
        acc[module] = {
          module,
          permission: [],
        };
      }
      acc[module].permission.push(item);
      return acc;
    }, {})
  );
}
function flattenGroupedPermissions(
  groupedPermissions,
  roleId = null,
  permissionsList
) {
  // Build a Map with key: "module_operation", value: is_permit
  const grantedMap = new Map();

  for (const group of groupedPermissions) {
    for (const perm of group.permission) {
      const key = `${perm.module}_${perm.operation}`;
      grantedMap.set(key, perm.is_permit ?? false); // default false if missing
    }
  }

  // Map over full permissions list and set is_permit from the Map
  return permissionsList.map((permission) => {
    const key = `${permission.module}_${permission.operation}`;
    return {
      role_id: roleId,
      module: permission.module,
      operation: permission.operation,
      is_permit: grantedMap.has(key) ? grantedMap.get(key) : false,
    };
  });
}

export { groupPermissionsByModule, flattenGroupedPermissions };
