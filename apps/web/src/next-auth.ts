import { prisma } from "@rallly/database";
import { posthog } from "@rallly/posthog/server";
import { redirect } from "next/navigation";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import { cache } from "react";

import { CustomPrismaAdapter } from "./auth/adapters/prisma";
import { isEmailBanned, isEmailBlocked } from "./auth/helpers/is-email-blocked";
import { mergeGuestsIntoUser } from "./auth/helpers/merge-user";
import { EmailProvider } from "./auth/providers/email";
import { GoogleProvider } from "./auth/providers/google";
import { GuestProvider } from "./auth/providers/guest";
import { MicrosoftProvider } from "./auth/providers/microsoft";
import { OIDCProvider } from "./auth/providers/oidc";
import { RegistrationTokenProvider } from "./auth/providers/registration-token";
import { nextAuthConfig } from "./next-auth.config";

const {
  auth: originalAuth,
  handlers,
  signIn,
  signOut,
} = NextAuth({
  ...nextAuthConfig,
  adapter: CustomPrismaAdapter({
    migrateData: async (userId) => {
      const session = await auth();
      if (session?.user && session.user.email === null) {
        await mergeGuestsIntoUser(userId, [session.user.id]);
      }
    },
  }),
  providers: [
    RegistrationTokenProvider,
    EmailProvider,
    GuestProvider,
    ...([GoogleProvider(), OIDCProvider(), MicrosoftProvider()].filter(
      Boolean,
    ) as Provider[]),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 60,
  },
  cookies: {
    sessionToken: {
      options: {
        maxAge: 60 * 60 * 24 * 60,
      },
    },
  },
  events: {
    createUser({ user }) {
      if (user.id) {
        posthog?.capture({
          distinctId: user.id,
          event: "register",
          properties: {
            $set: {
              name: user.name,
              email: user.email,
              timeZone: user.timeZone ?? undefined,
              locale: user.locale ?? undefined,
            },
          },
        });
      }
    },
    signIn({ user, account }) {
      if (user.id) {
        posthog?.capture({
          distinctId: user.id,
          event: "login",
          properties: {
            method: account?.provider,
            $set: {
              name: user.name,
              email: user.email,
              timeZone: user.timeZone ?? undefined,
              locale: user.locale ?? undefined,
            },
          },
        });
      }
    },
  },
  callbacks: {
    ...nextAuthConfig.callbacks,
    async signIn({ user, email, profile }) {
      const distinctId = user.id;
      // prevent sign in if email is not verified
      if (
        profile &&
        "email_verified" in profile &&
        profile.email_verified === false &&
        distinctId
      ) {
        posthog?.capture({
          distinctId,
          event: "login failed",
          properties: {
            reason: "email not verified",
          },
        });
        return false;
      }

      if (user.banned) {
        return false;
      }

      // Make sure email is allowed
      if (user.email) {
        if (isEmailBlocked(user.email) || (await isEmailBanned(user.email))) {
          return false;
        }
      }

      // For now, we don't allow users to login unless they have
      // registered an account. This is just because we need a name
      // to display on the dashboard. The flow can be modified so that
      // the name is requested after the user has logged in.
      if (email?.verificationRequest) {
        const isRegisteredUser =
          (await prisma.user.count({
            where: {
              email: user.email as string,
            },
          })) > 0;

        return isRegisteredUser;
      }

      // when we login with a social account for the first time, the user is not created yet
      // and the user id will be the same as the provider account id
      // we handle this case the the prisma adapter when we link accounts
      const isInitialSocialLogin = user.id === profile?.sub;

      if (!isInitialSocialLogin) {
        // merge guest user into newly logged in user
        const session = await auth();
        if (user.id && session?.user && !session.user.email) {
          await mergeGuestsIntoUser(user.id, [session.user.id]);
        }
      }

      return true;
    },
    async jwt({ token }) {
      const userId = token.sub;
      const isGuest = userId?.startsWith("guest-");

      if (userId && !isGuest) {
        const user = await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            name: true,
            email: true,
            image: true,
          },
        });

        if (user) {
          token.name = user.name;
          token.email = user.email;
          token.picture = user.image;
        }
      }

      return token;
    },
  },
});

const auth = cache(async () => {
  try {
    const session = await originalAuth();
    if (session) {
      return session;
    }
  } catch (e) {
    console.error("FAILED TO GET SESSION", e);
  }
});

const requireUser = async () => {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return { userId: session.user.id };
};

/**
 * If email is not set it means the user is a guest
 * @returns
 */
export const getUserId = async () => {
  const session = await auth();
  return session?.user?.email ? session.user.id : undefined;
};

export const getLoggedIn = async () => {
  const session = await auth();
  return !!session?.user?.email;
};

export { auth, handlers, requireUser, signIn, signOut };
