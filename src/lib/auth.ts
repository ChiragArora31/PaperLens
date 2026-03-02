import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { ensureOAuthUser, getUserByEmail } from './db';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const authSecret =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'paperlens-dev-secret-change-me' : undefined);

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Email and Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const email = parsed.data.email.toLowerCase().trim();
      const user = getUserByEmail(email);
      if (!user?.passwordHash) return null;

      const validPassword = await compare(parsed.data.password, user.passwordHash);
      if (!validPassword) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.unshift(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  providers,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      if (account?.provider === 'google') {
        ensureOAuthUser({
          email: user.email,
          name: user.name,
          image: user.image,
          provider: 'google',
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (!email) return token;

      const dbUser = getUserByEmail(email);
      if (dbUser) {
        token.sub = dbUser.id;
        token.email = dbUser.email;
        token.name = dbUser.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
