import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { createUser, getUserByEmail } from '@/lib/db';

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid signup details.' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const name = parsed.data.name?.trim() || null;

    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(parsed.data.password, 12);
    createUser({ email, name, passwordHash: hashedPassword, provider: 'credentials' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to create account right now.' },
      { status: 500 }
    );
  }
}
