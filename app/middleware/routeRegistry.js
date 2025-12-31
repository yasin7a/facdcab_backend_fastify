import throwError from "../utilities/throwError.js";

function extractModuleAndOperation(url, knownPrefixes) {
  const urlParts = url.split("/").filter(Boolean);
  let moduleName = null;
  let moduleIndex = -1;

  for (const prefix of knownPrefixes) {
    const index = urlParts.indexOf(prefix);
    if (index !== -1) {
      moduleName = prefix;
      moduleIndex = index;
      break;
    }
  }

  if (!moduleName) return null;
  const operation = urlParts[moduleIndex + 1];
  return { moduleName, operation };
}

function setupRouteRegistry(fastify, protectedRoutes) {
  const routesList = [];
  const knownPrefixes = protectedRoutes.map((r) => r.prefix.replace("/", ""));
  const skipPermissionModules = new Set(
    protectedRoutes
      .filter((r) => r.skipPermission)
      .map((r) => r.prefix.replace("/", ""))
  );
  const routesSet = new Set();

  fastify.addHook("onRoute", (routeOptions) => {
    if (routeOptions.method === "HEAD") return;

    const result = extractModuleAndOperation(routeOptions.url, knownPrefixes);
    if (!result) return;

    const { moduleName, operation } = result;

    if (!operation || operation.startsWith(":")) {
      throw throwError(
        500,
        `Invalid operation: ${routeOptions.method} ${routeOptions.url}. Must use explicit operation name (e.g., /list, /create, /update, /delete, /show/:id)`
      );
    }

    const routeKey = `${moduleName}:${operation}:${routeOptions.method}`;

    if (!routesSet.has(routeKey)) {
      routesSet.add(routeKey);
      routesList.push({
        module: moduleName,
        operation,
        is_permit: false,
        method: routeOptions.method,
        url: routeOptions.url,
      });
    }
  });

  fastify.decorate("adminRoutesList", routesList);
  fastify.decorate("skipPermissionModules", skipPermissionModules);
  fastify.decorate("extractModuleAndOperation", (url) =>
    extractModuleAndOperation(url, knownPrefixes)
  );
}

export default setupRouteRegistry;
