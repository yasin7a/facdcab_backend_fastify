import fastifyOAuth2 from "fastify-oauth2";
import serverConfig from "../../config/server.config.js";
import { prisma } from "../lib/prisma.js";
import generateToken from "../utilities/generateToken.js";
import generateUniqueSlug from "../utilities/slugify.js";

async function googleOAuthPlugin(app) {
  await app.register(fastifyOAuth2, {
    name: "googleOAuth2",
    scope: ["openid", "profile", "email"],
    credentials: {
      client: {
        id: serverConfig.GOOGLE_CLIENT_ID,
        secret: serverConfig.GOOGLE_CLIENT_SECRET,
      },
      auth: fastifyOAuth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: "/auth/google/login",
    callbackUri: `${serverConfig.BASE_URL}/auth/google/callback`,
    callbackUriParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });

  app.get("/auth/google/callback", async (request, reply) => {
    try {
      // Ensure code exists
      if (!request.query.code) {
        throw new Error("Authorization code is missing in callback URL");
      }
      // Exchange code for token
      const accessData =
        await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      if (!accessData || !accessData.access_token) {
        throw new Error("Failed to get access token from Google");
      }
      const { access_token } = accessData;

      // Fetch user info from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: "application/json",
          },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error("Failed to fetch Google user info");
      }

      const googleUser = await userInfoResponse.json();
      const { email, given_name, family_name, picture } = googleUser;

      if (!email) {
        throw new Error("Email is required from Google profile");
      }

      // Find or create user in DB
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        const slug = await generateUniqueSlug(given_name, null, prisma.user);
        user = await prisma.user.create({
          omit: {
            password: true,
          },
          data: {
            email,
            first_name: given_name || "",
            last_name: family_name || "",
            avatar: picture ? { url: picture } : null,
            is_active: true,
            is_verified: true,
            user_type: UserType.USER,
            slug,
          },
        });
      } else if (!user.is_active) {
        throw new Error("User account is deactivated");
      } else if (!user.is_verified) {
        throw new Error("User account is not verified");
      }

      // if (serverConfig.DEVELOPMENT_PRODUCTION_UNSAFE_AUTH) {
      //   // // token mange by frontend: Redirect to frontend
      //   // const token = await generateToken(user, reply, true);
      //   // return reply.redirect(
      //   //   `${serverConfig.CLIENT_URL}/auth/google?token=${token}`
      //   // );
      // } else {
      // token mange by backend setCookie: Redirect to frontend
      await generateToken(user, reply, false, true);
      return reply.redirect(
        `${
          serverConfig.CLIENT_URL
        }/panel/${user?.user_type?.toLowerCase()}/dashboard`
      );
      // }
    } catch (error) {
      console.error("Google OAuth error:", error);
      return reply.redirect(
        `${serverConfig.CLIENT_URL}/auth/error?message=${encodeURIComponent(
          error.message
        )}`
      );
    }
  });
}

export default googleOAuthPlugin;
