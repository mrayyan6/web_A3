import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface User {
    role: 'Admin' | 'Agent';
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'Admin' | 'Agent';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'Admin' | 'Agent';
  }
}
