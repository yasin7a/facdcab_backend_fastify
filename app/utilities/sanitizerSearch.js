const sanitizedSearch = (search) => search.replace(/[%_]/g, "\\$&");
export default sanitizedSearch;
