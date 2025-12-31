function extractAuthToken(input) {
  if (typeof input !== "string") {
    return null;
  }

  const regex = /(?:^|\s)auth_token=([A-Za-z0-9\-_\.]+)/;
  const match = input.match(regex);

  return match ? match[1] : null;
}
export default extractAuthToken;
