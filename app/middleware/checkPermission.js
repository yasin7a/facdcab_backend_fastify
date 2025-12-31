import httpStatus from "../utilities/httpStatus.js";
import throwError from "../utilities/throwError.js";
import { hasPermission } from "../utilities/rolePermissionCache.js";
import { UserType } from "../utilities/constant.js";

function createPermissionChecker() {
  return async function checkPermission(request, reply) {
    const result = request.server.extractModuleAndOperation(request.url);
    if (!result) return;

    const { moduleName, operation } = result;

    // Skip permission check for modules with skipPermission flag (O(1) Set lookup)
    if (request.server.skipPermissionModules.has(moduleName)) {
      return;
    }

    // Admin users have full access
    if (request.user_type === UserType.ADMIN) {
      return;
    }

    if (!operation) {
      throw throwError(httpStatus.FORBIDDEN, "Unauthorized operation");
    }

    // O(1) permission check using Set (with auto-load if needed)
    if (!(await hasPermission(request.role_id, moduleName, operation))) {
      throw throwError(httpStatus.FORBIDDEN, "Forbidden");
    }
  };
}

export default createPermissionChecker;
