const isNullOrEmpty = (value) => {
  if (value === null || value === undefined) return true;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();

    return (
      v === "" ||
      v === "null" ||
      v === "undefined" ||
      v === '""' ||
      v === "''" ||
      v === '" "' ||
      v === "' '" ||
      v === "` `"
    );
  }

  if (typeof value === "number") {
    return Number.isNaN(value);
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object" && value.constructor === Object) {
    return Object.keys(value).length === 0;
  }

  return false;
};

export default isNullOrEmpty;
