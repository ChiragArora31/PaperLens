import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

function configuredAdminEmails(): string[] {
  return (process.env.PAPERLENS_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  const admins = configuredAdminEmails();
  if (admins.length === 0) return false;
  return Boolean(email && admins.includes(email.toLowerCase()));
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    return null;
  }
  return session;
}
