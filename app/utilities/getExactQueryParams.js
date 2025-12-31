function parseNestedKeys(obj, keys, value) {
  const lastKey = keys.pop();
  let current = obj;

  for (const key of keys) {
    if (!current[key] || typeof current[key] !== "object") current[key] = {};
    current = current[key];
  }

  // Handle repeated keys as array
  if (current[lastKey] !== undefined) {
    if (Array.isArray(current[lastKey])) {
      current[lastKey].push(value);
    } else {
      current[lastKey] = [current[lastKey], value];
    }
  } else {
    current[lastKey] = value;
  }
}

function getExactQueryParams(req) {
  const queryString = (req.originalUrl || "").split("?")[1] || "";
  const safeQuery = queryString.replace(/\+/g, "%2B"); // preserve '+'
  const params = new URLSearchParams(safeQuery);
  const result = {};

  for (const [key, value] of params.entries()) {
    // Handle nested keys like filters[name]
    if (key.includes("[")) {
      const keys = key.split(/\[|\]/).filter(Boolean);
      parseNestedKeys(result, keys, value);
    } else {
      // Handle repeated keys as array
      if (result[key] !== undefined) {
        if (Array.isArray(result[key])) {
          result[key].push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

export default getExactQueryParams;
