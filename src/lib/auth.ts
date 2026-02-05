import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

// Dev mode user ID - consistent across restarts
const DEV_USER_ID = 'dev-user-local';
const DEV_USER = {
  id: DEV_USER_ID,
  name: 'Dev User',
  email: 'dev@localhost',
  image: null,
};

// Helper to get session, with dev mode bypass
export async function getSession() {
  if (process.env.SKIP_AUTH === 'true') {
    return { user: DEV_USER };
  }
  return auth();
}

// Ensure dev user exists in database
export async function ensureDevUser() {
  if (process.env.SKIP_AUTH !== 'true') return;

  const existing = await prisma.user.findUnique({
    where: { id: DEV_USER_ID },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        id: DEV_USER_ID,
        name: DEV_USER.name,
        email: DEV_USER.email,
      },
    });
  }
}
