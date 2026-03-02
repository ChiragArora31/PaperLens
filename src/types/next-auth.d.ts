import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    hashedPassword?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string;
  }
}
