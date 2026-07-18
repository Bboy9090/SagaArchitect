import type { NextAuthOptions } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Clean the adapter type to match NextAuthOptions expectations
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const adapter = db ? DrizzleAdapter(db as any, {
  usersTable: schema.users,
  accountsTable: schema.accounts,
  sessionsTable: schema.sessions,
  verificationTokensTable: schema.verificationTokens,
} as any) as any : undefined;

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!db) {
          throw new Error('Database not initialized.');
        }

        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required.');
        }

        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, credentials.email))
          .limit(1);

        if (!user) {
          throw new Error('No user found with this email.');
        }

        const isPasswordCorrect = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isPasswordCorrect) {
          throw new Error('Invalid password.');
        }

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
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'phoenix-studio-local-development-secret-key-1234',
};
