import type { NextAuthOptions } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { assertAuthDeploymentUrl, authCookiePolicy, authUsesSecureCookies } from '@/lib/auth-security';
import { getAuthSecret } from '@/lib/env-validator';

assertAuthDeploymentUrl();

// The upstream Auth.js adapter types do not yet exactly match the Drizzle schema overloads.
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const adapter = db ? DrizzleAdapter(db as any, {
  usersTable: schema.users,
  accountsTable: schema.accounts,
  sessionsTable: schema.sessions,
  verificationTokensTable: schema.verificationTokens,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
} as any) as any : undefined;

const cookiePolicy = authCookiePolicy();
const secureCookies = authUsesSecureCookies();

export const authOptions: NextAuthOptions = {
  adapter,
  useSecureCookies: secureCookies,
  cookies: secureCookies
    ? {
        sessionToken: {
          name: '__Secure-next-auth.session-token',
          options: cookiePolicy,
        },
        callbackUrl: {
          name: '__Secure-next-auth.callback-url',
          options: cookiePolicy,
        },
        csrfToken: {
          name: '__Host-next-auth.csrf-token',
          options: cookiePolicy,
        },
      }
    : undefined,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!db) throw new Error('Authentication service unavailable.');
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid email or password.');
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, normalizedEmail))
          .limit(1);

        if (!user) throw new Error('Invalid email or password.');

        const isPasswordCorrect = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isPasswordCorrect) throw new Error('Invalid email or password.');

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === 'string') session.user.id = token.id;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: getAuthSecret(),
};
