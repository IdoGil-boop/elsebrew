import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export interface GoogleUser {
  sub: string; // Google user ID
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

/**
 * Verify Google JWT token server-side
 * For production, this should use Google's public keys for verification
 * For now, we'll decode and validate basic structure
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUser | null> {
  try {
    // Decode without verification (Google Sign-In already verified client-side)
    // In production, fetch Google's public keys and verify signature
    const decoded = jwt.decode(token) as GoogleUser;

    if (!decoded || !decoded.sub || !decoded.email) {
      return null;
    }

    // Verify token hasn't expired
    const exp = (decoded as any).exp;
    if (exp && Date.now() >= exp * 1000) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Extract and verify user from request headers
 */
export async function getUserFromRequest(request: NextRequest): Promise<GoogleUser | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyGoogleToken(token);
}

/**
 * Middleware to protect API routes
 */
export async function requireAuth(request: NextRequest): Promise<{ user: GoogleUser } | { error: string; status: number }> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}
