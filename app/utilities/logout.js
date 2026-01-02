const logout = (reply) => {
  reply.clearCookie("auth_token", { path: "/" });
  reply.clearCookie("isSignedIn", { path: "/" });
};
export default logout;
